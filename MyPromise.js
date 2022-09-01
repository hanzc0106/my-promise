module.exports = class MyPromise {
  static PENDING = 'pending'
  static RESOLVED = 'resolved'
  static REJECTED = 'rejected'
  static id = 0;

  // 用于
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

  resolve = (value) => {
    if (this.state === MyPromise.PENDING) {
      this.state = MyPromise.RESOLVED
      this.value = value

      if (this.fulfillCallbacks.length) {
        this.fulfillCallbacks.forEach((cb) => cb())
        this.fulfillCallbacks = []
      }
    }
  }

  reject = (reason) => {
    if (this.state === MyPromise.PENDING) {
      this.state = MyPromise.REJECTED
      this.reason = reason

      if (this.rejectCallbacks.length) {
        this.rejectCallbacks.forEach((cb) => cb())
        this.rejectCallbacks = []
      }
    }
  }

  then = (onFulfilled, onRejected) => {
    onFulfilled =
      typeof onFulfilled === 'function' ? onFulfilled : (value) => value
    onRejected =
      typeof onRejected === 'function'
        ? onRejected
        : (reason) => {
            throw reason
          }

    const promise2 = new MyPromise((resolve, reject) => {
      const fulfillFunc = (value) => {
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
        this.fulfillCallbacks.push(() => fulfillFunc(this.value))
        this.rejectCallbacks.push(() => rejectFunc(this.reason))
      } else if (this.state === MyPromise.RESOLVED) {
        fulfillFunc(this.value)
      } else if (this.state === MyPromise.REJECTED) {
        rejectFunc(this.reason)
      }
    })
    return promise2
  }
}

const resolvePromise = (promise2, x, resolve, reject) => {
  if (promise2 === x) {
    return reject(new TypeError('the same promise with then func returns'))
  }
  // 对thenable对象来说, resolve和reject可能没有互斥关系, 会重复调用,
  // 所以用called约束只调用一次
  let called
  if (x != null && (typeof x === 'function' || typeof x === 'object')) {
    try {
      const then = x.then
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
