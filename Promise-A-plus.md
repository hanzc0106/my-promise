# Promise/A+

## promise 状态

1. promise只有3个状态: `pending`, `fulfilled`, `rejected`
2. 状态转移 `pending` -> `funfilled` ; `pending` -> `rejected`
3. `fulfilled`状态不可变, 此状态下有`value`, `value`不可修改
4. `rejected`状态不可变, 此状态下有`reason`, `reason`不可修改

## `then`方法

1. `promise`必须提供`then`方法, 通过`then`方法访问`promise`的`value`或`reason`
2. `then`方法接收两个参数: `promise.then(onFulfilled, onRejected)`
3. `onFulfilled`和`onRejected`都是可选参数
   - 当`onFulfilled`不是函数时, 忽略`onFulfilled`
   - `onRejected`同理

4. 如果`onFulfilled`是方法
   - 当`promise`状态完成时, 必须调用`onFulfilled`, 并且传入`promise`的`value`作为第一个参数
   - 当`promise`状态未完成时, 不调用`onFulfilled`
   - 只可调用一次

5. 如果`onRejected`是方法
   - 当`promise`状态失败时, 必须调用`onRejected`, 并且传入`promise`的`reason`作为第一个参数
   - 当`promise`状态未完成时, 不调用`onRejected`
   - 只可调用一次

6. `onFulfilled` 和 `onRejected` 必须在函数执行栈清空时才调用, 也就是在下一个微任务或宏任务中调用.
7. `onFulfilled` 和 `onRejected` 调用时不能使用`this`
8. 单个 `promise` 的 `then` 可以多次调用
   - 如果 `promise` 已经完成, 所有通过 `then` 监听的 `onFulfilled` 必须按顺序依次调用
   - 如果 `promise` 已经失败, 所有通过 `then` 监听的 `onRejected` 必须按顺序依次调用

9. `then` 必须返回一个`promise`
   - 如果 `onFulfilled` 或 `onRejected` 返回一个值 `x`, 运行 `Promise Resolution Procedure` 处理 `x` (`[[Resolve]](promise2, x)`) 
   - 如果 `onFulfilled` 或 `onRejected` 抛出一个异常 `e`, `promise2` 必须是失败状态, 且原因为 `e`
   - 如果 `onFulfilled` 不是方法并且 `promise1` 完成, `promise2` 必须是完成状态, 且值为 `promise1` 的 `value`
   - 如果 `onRejected` 不是方法并且 `promise1` 失败, `promise2` 必须是失败状态, 且原因为 `promise1` 的 `reason`

## `The Promise Resolution Procedure`

> 由于 `onFulfilled` (或 `onRejected` ) 的返回值类型可能有多种情况, 尤其是可能返回一个 `promise` , 因此需要一个独立的方法处理 `onFulfilled` (或 `onRejected` ) 的返回值

### `[[Resolve]](promise, x)` 流程:

1. 如果 `promise` 和 `x` 是同一个对象, 以一个 `TypeError` 为原因拒绝 `promise`
2. 如果 `x` 是一个 `promise`:
   - 如果 `x` 是 `pending` 状态, `promise` 必须等待 `x` 转变为 `fulfilled` 或 `rejected` 状态
   - 如果/当 `x` 转变为 `fulfilled` 状态, 使用 `x` 完成的`value` 完成 `promise`
   - 如果/当 `x` 转变为 `rejected` 状态, 使用 `x` 失败的`reason` 失败 `promise`

3. 如果 `x` 是 对象 或 方法
   - 使 `then` 为 `x.then`
   - 如果获取 `x.then` 抛出了异常 `e`, 用 `e` 作为 `promise` 失败的原因
   - 如果 `then` 是方法, 将 `x` 作为 `this` 调用 `then`, 参数依次为 `resolvePromise, rejectPromise`
     - 如果/当 `resolvePromise` 被值 `y` 调用时, 再次运行 `[[Resolve]](promise, x)`
     - 如果/当 `rejectPromise` 被原因 `r` 调用时, 用 `r` 作为 `promise` 失败的原因
     - 如果 `resolvePromise` 和 `rejectPromise` 都被调用了, 第一个调用的生效, 之后调用的忽略
     - 如果调用 `then` 抛出异常 `e`
       - 如果 `resolvePromise` 或 `rejectPromise` 已经被调用了, 忽略 `e`
       - 否则 将 `e` 作为 `promise` 失败的原因
   - 如果 `then` 不是方法, 使用 `x` 作为值完成 `promise`

4. 如果 `x` 是其他类型的值, 使用 `x` 作为值完成 `promise`