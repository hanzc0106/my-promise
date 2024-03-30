// todo : promise.cancel

module.exports = class MyPromiseV2 {
    static PENDING = 'pending';
    static FULFILLED = 'fulfilled';
    static REJECTED = 'rejected';

    status = MyPromiseV2.PENDING;
    value = null;
    reason = null;
    resolveCallbacks = [];
    rejectCallbacks = [];

    // 用于 promise-aplus-tests
    static deferred = function () {
        let defer = {};
        defer.promise = new MyPromiseV2((resolve, reject) => {
            defer.resolve = resolve;
            defer.reject = reject;
        });
        return defer;
    };

    constructor(executor) {
        try {
            executor(this.resolve, this.reject);
        } catch (e) {
            this.reject(e);
        }
    }

    // this要确保绑定为当前promise对象
    resolve = (value) => {
        if (this.status === MyPromiseV2.PENDING) {
            this.status = MyPromiseV2.FULFILLED;
            this.value = value;
            this.resolveCallbacks.forEach((cb) => cb(value));
        }
    };

    // this要确保绑定为当前promise对象
    reject = (reason) => {
        if (this.status === MyPromiseV2.PENDING) {
            this.status = MyPromiseV2.REJECTED;
            this.reason = reason;
            this.rejectCallbacks.forEach((cb) => cb(reason));
        }
    };

    // this要确保绑定为当前promise对象
    then = (onFulfilled, onRejected) => {
        onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : (value) => value;
        onRejected =
            typeof onRejected === 'function'
                ? onRejected
                : (reason) => {
                      throw reason;
                  };

        const promise = new MyPromiseV2((resolve, reject) => {
            const onFulfilledFunc = (value) => {
                queueMicrotask(() => {
                    try {
                        const x = onFulfilled(value);
                        resolutionProcedure(promise, x, resolve, reject);
                    } catch (e) {
                        reject(e);
                    }
                });
            };
            const onRejectedFunc = (reason) => {
                queueMicrotask(() => {
                    try {
                        const x = onRejected(reason);
                        resolutionProcedure(promise, x, resolve, reject);
                    } catch (e) {
                        reject(e);
                    }
                });
            };

            switch (this.status) {
                case MyPromiseV2.PENDING:
                    this.resolveCallbacks.push((value) => onFulfilledFunc(value));
                    this.rejectCallbacks.push((reason) => onRejectedFunc(reason));
                    break;
                case MyPromiseV2.FULFILLED:
                    onFulfilledFunc(this.value);
                    break;
                case MyPromiseV2.REJECTED:
                    onRejectedFunc(this.reason);
                    break;
            }
        });

        return promise;
    };

    // this要确保绑定为当前promise对象
    catch = (onRejected) => {
        return this.then(undefined, onRejected);
    };

    finally = (onFinal) => {
        return onFinal();
    };

    static resolve(value) {
        // 处理promise对象
        if (value instanceof MyPromiseV2) {
            return value;
        }

        // 处理thenable对象
        const isObject = value !== null && (typeof value === 'object' || typeof value === 'function');
        if (isObject) {
            try {
                const then = value.then;
                if (typeof then === 'function') {
                    return new MyPromiseV2((resolve) => {
                        then.call(
                            value,
                            (y) => resolve(y),
                            () => resolve()
                        );
                    });
                } else {
                    return new MyPromiseV2(value);
                }
            } catch (e) {
                return new MyPromiseV2(value);
            }
        }

        // 处理其他类型
        return new MyPromiseV2((resolve) => {
            resolve(value);
        });
    }

    static reject(reason) {
        if (reason instanceof MyPromiseV2) {
            return reason;
        }

        // 处理thenable对象
        const isObject = value !== null && (typeof value === 'object' || typeof value === 'function');
        if (isObject) {
            try {
                const then = value.then;
                if (typeof then === 'function') {
                    return new MyPromiseV2((_, reject) => {
                        then.call(
                            value,
                            () => reject(),
                            (e) => reject(e)
                        );
                    });
                } else {
                    return new MyPromiseV2((_, reject) => reject(reason));
                }
            } catch (e) {
                return new MyPromiseV2((_, reject) => reject(reason));
            }
        }

        return new MyPromiseV2((_, reject) => {
            reject(reason);
        });
    }

    static all(promises) {
        return new MyPromiseV2((resolve, reject) => {
            try {
                checkPromises(promises);

                let n = promises.length;
                let res = Array(n);
                promises.forEach((promise, i) => {
                    promise.then(
                        (v) => {
                            res[i] = v;
                            if (n > 0) n--;
                            else resolve(res);
                        },
                        (e) => {
                            reject(e);
                        }
                    );
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    static allSettled(promises) {
        return new MyPromiseV2((resolve, reject) => {
            try {
                checkPromises(promises);

                let n = promises.length;
                let res = Array(n);
                promises.forEach((promise, i) => {
                    promise.then(
                        (v) => {
                            res[i] = v;
                            if (n > 0) n--;
                            else resolve(res);
                        },
                        (e) => {
                            res[i] = e;
                            if (n > 0) n--;
                            else resolve(res);
                        }
                    );
                });
            } catch (e) {
                reject(e);
            }
        });
    }

    static race(promises) {
        return new MyPromiseV2((resolve, reject) => {
            try {
                checkPromises(promises);

                promises.forEach((promise) => {
                    promise.then(resolve, reject);
                });
            } catch (e) {
                reject(e);
            }
        });
    }
    
    static any(promises) {
        return new MyPromiseV2((resolve, reject) => {
            try {
                checkPromises(promises);

                let n = promises.length;
                let errs = Array(n);
                promises.forEach((promise, i) => {
                    promise.then(resolve, (e) => {
                        errs[i] = e;
                        if (n > 0) n--;
                        else reject(errs);
                    });
                });
            } catch (e) {
                reject(e);
            }
        });
    }
};

/**
 * 解析x的值, 以确定promise的最终状态
 * @param {*} promise 原始promise对象
 * @param {*} x 初始为executor返回的值; 如果executor返回的值是thenable对象, 那么继续对thenable对象递归求值
 * @param {*} resolve 原始promise的resolve方法引用, 用于在完成时修改原始promise状态
 * @param {*} reject 原始promise的reject方法引用, 用于在完成时修改原始promise状态
 * @returns
 */
function resolutionProcedure(promise, x, resolve, reject) {
    if (promise === x) {
        reject(new TypeError('promise object loop reference'));
        return;
    }

    let isObjectOrFunction = (typeof x === 'object' && x !== null) || typeof x === 'function';
    let then;

    // 获取属性的操作也可能抛出错误, 比如:
    // {
    //     then: {
    //         get: function () { throw e }
    //     }
    // }
    try {
        then = isObjectOrFunction ? x.then : null;
    } catch (e) {
        reject(e);
    }

    if (typeof then === 'function') {
        // then方法中的调用方式不可知, 要确保成功和失败的分支只会调用一次, 重复调用会被忽略
        let called = false;
        try {
            then.call(
                x,
                (y) => {
                    if (called) return;
                    called = true;
                    resolutionProcedure(promise, y, resolve, reject);
                },
                (e) => {
                    if (called) return;
                    called = true;
                    reject(e);
                }
            );
        } catch (e) {
            if (called) return;
            called = true;
            reject(e);
        }
    } else {
        resolve(x);
    }
}

function checkPromises(promises) {
    if (!Array.isArray(promises)) {
        throw new TypeError('Parameter promises is not an Array');
    }
    promises.forEach((promise, i) => {
        if (!promise instanceof MyPromiseV2) {
            throw TypeError(`Parameter promises[${i}] is not an instance of MyPromiseV2`);
        }
    });
}
