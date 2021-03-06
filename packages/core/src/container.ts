import { setClassMetadata, hasClassMetadata } from './metadata';
import { _ } from './utils';

export interface ContainerBinding<T = Object> {
  (container: Container): T;
}

export class Container {

  private classes = new Map<Function, any>();
  private bindings = new Map<Function, ContainerBinding>();

  private waitForInstance(targetClass: Function) {
    if (this.classes.has(targetClass)) {
      throw new Error(`Container is already waiting or already have ${targetClass.name} instance`);
    }
    this.classes.set(targetClass, true);
  }

  private isWaitingForInstance(targetClass: Function) {
    return this.classes.get(targetClass) === true;
  }

  private getWaitingClassNames() {
    let waitingClasses: string[] = [];
    this.classes.forEach((instance, waitingClass) => {
      if (instance === true) {
        waitingClasses.push(waitingClass.name);
      }
    });
    return waitingClasses;
  }

  getResolvedClasses() {
    let resolvedClasses: Function[] = [];
    this.classes.forEach((instance, instanceClass) => {
      if (instance && instance !== true) {
        resolvedClasses.push(instanceClass);
      }
    });
    return resolvedClasses;
  }

  hasInstanceOf(targetClass: Function) {
    return this.classes.get(targetClass) instanceof targetClass;
  }

  has(targetClass: Function) {
    let instance = this.classes.get(targetClass);
    if (!instance || instance === true) {
      return false;
    }
    return true;
  }

  set(targetClass: Function, instance: Object) {
    if (!_.isObject(instance)) {
      throw new Error(`Invalid instance type: ${typeof instance}`);
    }
    this.classes.set(targetClass, instance);
  }

  get<T = Object>(targetClass: Function): T {
    let instance = this.classes.get(targetClass);
    if (!instance || instance === true) {
      throw new Error(`Class "${targetClass.name}" does not have a registered instance or not expected by container`);
    }
    return instance;
  }

  resolve<T = Object>(targetClass: Function): T {
    if (this.has(targetClass)) {
      return this.get(targetClass);
    }

    if (!this.isWaitingForInstance(targetClass)) {
      this.waitForInstance(targetClass);
    } else {
      throw new Error(`Circular dependency ${this.getWaitingClassNames().join(' -> ')} -> ${targetClass.name}`);
    }

    let instance = null;
    const binding = this.bindings.get(targetClass);
    if (!binding) {

      if (!hasClassMetadata(targetClass, 'classType')) {
        throw new Error(`${targetClass.name} class is not decorated`);
      }

      const dependencies: Object[] = [];
      const paramTypes = Reflect.getMetadata('design:paramtypes', targetClass);
      if (paramTypes) {
        for (let ParamTypeClass of paramTypes) {
          if (typeof ParamTypeClass != 'function') {
            throw new Error(`Invalid parameter type: ${typeof ParamTypeClass}`);
          }
          dependencies.push(this.resolve(ParamTypeClass));
        }
      }

      instance = Reflect.construct(targetClass, dependencies);
    } else {
      instance = binding(this);
    }

    this.set(targetClass, instance);
    return instance;
  }

  bind<T>(targetClass: Function, handler: ContainerBinding<T>) {
    if (typeof handler != 'function') {
      throw new Error('Container binding should be a function');
    }
    this.bindings.set(targetClass, handler);
  }
}

export function Injectable() {
  return (target: Function) => {
    setClassMetadata(target, 'classType', 'injectable');
  };
}
