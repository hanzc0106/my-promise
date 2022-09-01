module.exports = class MyPromise {
  static PENDING = 'pending'
  static RESOLVED = 'resolved'
  static REJECTED = 'rejected'
  static id = 0;

  // 用于 promise-aplus-tests
  static deferred = function () {
    let defer = {}
    defer.promise = new MyPromise((resolve, reject) => {
      defer.resolve = resolve
      defer.reject = reject
    })
    return defer
  }

  constructor(executor) {
    this.id = MyPromise.id++
    this.state = MyPromise.PENDING
    this.value = null
    this.reason = null
    this.fulfillCallbacks = []
    this.rejectCallbacks = []

    try {
      executor(this.resolve, this.reject)
    } catch (e) {
      this.reject(e)
    }
  }

  // 箭头函数绑定this
  resolve = (value) => {
    // 只有pending状态下才改变状态, 保证状态不会多次改变
    if (this.state === MyPromise.PENDING) {
      this.state = MyPromise.RESOLVED
      this.value = value

      // resolve只会调用一次, 所以fulfillCallbacks中的函数也之后调用一次
      // resolve调用完成后, 再调用then, 不会触发之前的fulfillCallbacks调用
      this.fulfillCallbacks.forEach((cb) => cb())
    }
  }

  reject = (reason) => {
    if (this.state === MyPromise.PENDING) {
      this.state = MyPromise.REJECTED
      this.reason = reason

      this.rejectCallbacks.forEach((cb) => cb())
    }
  }

  then = (onFulfilled, onRejected) => {
    // onFulfilled的有效值只有函数, 其他类型的值忽略
    // 正常情况下onFulfilled的返回值会作为promise2的值传出;
    // 但当onFulfilled为空(被忽略)时, 需要透传上一个promise的值, 所以使用(value) => value作默认值
    onFulfilled =
      typeof onFulfilled === 'function' ? onFulfilled : (value) => value
    onRejected =
      typeof onRejected === 'function'
        ? onRejected
        : (reason) => {
            throw reason
          }

    // then 需要返回一个新的promise
    const promise2 = new MyPromise((resolve, reject) => {
      const fulfillFunc = (value) => {
        // onFulfilled 需要在下一个事件循环中执行, 压入微任务栈
        queueMicrotask(() => {
          try {
            const x = onFulfilled(value)
            resolvePromise(promise2, x, resolve, reject)
          } catch (e) {
            reject(e)
          }
        })
      }
      const rejectFunc = (reason) => {
        queueMicrotask(() => {
          try {
            const x = onRejected(reason)
            resolvePromise(promise2, x, resolve, reject)
          } catch (e) {
            reject(e)
          }
        })
      }

      if (this.state === MyPromise.PENDING) {
        // 延时任务缓存回调, 等待延时任务完成
        this.fulfillCallbacks.push(() => fulfillFunc(this.value))
        this.rejectCallbacks.push(() => rejectFunc(this.reason))
      } else if (this.state === MyPromise.RESOLVED) {
        // 状态确定后直接执行回调(压入微任务队列)
        fulfillFunc(this.value)
      } else if (this.state === MyPromise.REJECTED) {
        rejectFunc(this.reason)
      }
    })
    return promise2
  }
}

// onFulfilled 和 onRejected 的返回值有多种可能, 对于thenable对象和其他对象的处理是不同的
const resolvePromise = (promise2, x, resolve, reject) => {
  // 避免单节点环路 (多节点环路规范中不要求)
  if (promise2 === x) {
    return reject(new TypeError('the same promise with then func returns'))
  }
  // 对thenable对象来说, resolve和reject可能没有互斥关系, 会重复调用,
  // 所以用called约束只调用一次
  let called

  // 1. 为什么要判断x !== null?
  // 当x为null时, 需要直接resolve(x)
  // 而typeof null === 'object'
  // 如果不判断, 就会进入thenable分支, 在执行x.then时抛出异常, 变成reject(e)
  // 所以需要剔除x === null的情况

  // 2. 为什么要判断typeof x === 'function'
  // 因为js中的类型定义, 要么通过function和function原型定义; 要么通过class定义
  // 而 typeof function_a 和typeof class_a 都为'function'
  if (x !== null && (typeof x === 'function' || typeof x === 'object')) {
    try {
      const then = x.then
      // 如果一个对象有 then 属性, 而且 then 属性是一个函数, 那么这个对象是一个 thenable 对象
      // thenable 对象的 then 方法有两个参数: resolvePromise 和 rejectPromise
      // then 调用时需要绑定 thenable 对象作为它的 this
      if (typeof then === 'function') {
        then.call(
          x,
          (y) => {
            if (called) return
            called = true
            resolvePromise(promise2, y, resolve, reject)
          },
          (err) => {
            if (called) return
            called = true
            reject(err)
          }
        )
      } else {
        // 不是 thenable 对象, 直接 resolve 该对象(x)
        resolve(x)
      }
    } catch (e) {
      if (called) return
      called = true
      reject(e)
    }
  } else {
    resolve(x)
  }
}