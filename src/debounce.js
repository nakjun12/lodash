import root from './.internal/root.js';
import isObject from './isObject.js';

/**
 * 지정된 시간(`wait` 밀리초)이 지난 후, 또는 다음 브라우저 프레임이 그려질 때까지 
 * `func` 함수 호출을 지연하는 디바운스 함수를 생성합니다. 
 * 디바운스된 함수는 지연된 `func` 호출을 취소하는 `cancel` 메서드와 즉시 호출하는 `flush` 메서드를 제공합니다. 
 * `options`를 제공하여 `func`가 `wait` 타임아웃의 시작(leading)과/또는 끝(trailing)에 호출될지 여부를 지정할 수 있습니다. 
 * `func`는 디바운스 함수에 제공된 마지막 인자로 호출됩니다. 디바운스 함수에 대한 후속 호출은 마지막 `func` 호출의 결과를 반환합니다.

 * **참고:** `leading`과 `trailing` 옵션이 모두 `true`인 경우, `func`는 디바운스 함수가 `wait` 타임아웃 동안 한 번 이상 호출될 때만 타임아웃의 끝에 호출됩니다.
 *
 * `wait`가 `0`이고 `leading`이 `false`인 경우, `func` 호출은 다음 틱까지 지연되며, 이는 `setTimeout`을 0의 타임아웃으로 사용하는 것과 유사합니다.
 *
 * `wait`가 생략되고 환경에 `requestAnimationFrame`이 있는 경우, `func` 호출은 다음 프레임이 그려질 때까지 지연됩니다(일반적으로 약 16ms).
 *
 * 디바운스와 쓰로틀링의 차이점에 대한 자세한 내용은 [David Corbacho의 글](https://css-tricks.com/debouncing-throttling-explained-examples/)을 참조하세요.
 *
 * @since 0.1.0
 * @category Function
 * @param {Function} func 디바운스할 함수.
 * @param {number} [wait=0]
 *  지연시킬 밀리초의 수; 생략되면 사용 가능한 경우 `requestAnimationFrame`이 사용됩니다.
 * @param {Object} [options={}] 옵션 객체.
 * @param {boolean} [options.leading=false]
 *  타임아웃의 시작에 호출을 지정합니다.
 * @param {number} [options.maxWait]
 *  `func`가 호출되기 전 최대로 지연될 수 있는 시간.
 * @param {boolean} [options.trailing=true]
 *  타임아웃의 끝에 호출을 지정합니다.
 * @returns {Function} 새로운 디바운스 함수를 반환합니다.
 * @example
 *
 * // 윈도우 크기가 변하는 동안 비용이 많이 드는 계산을 피합니다.
 * jQuery(window).on('resize', debounce(calculateLayout, 150))
 *
 * // 클릭될 때 `sendMail`을 호출하며, 후속 호출은 디바운스됩니다.
 * jQuery(element).on('click', debounce(sendMail, 300, {
 *   'leading': true,
 *   'trailing': false
 * }))
 *
 * // 1초 동안의 디바운스된 호출 후 `batchLog`가 한 번만 호출되도록 합니다.
 * const debounced = debounce(batchLog, 250, { 'maxWait': 1000 })
 * const source = new EventSource('/stream')
 * jQuery(source).on('message', debounced)
 *
 * // 끝에 있는 디바운스된 호출을 취소합니다.
 * jQuery(window).on('popstate', debounced.cancel)
 *
 * // 보류 중인 호출이 있는지 확인합니다.
 * const status = debounced.pending() ? "대기 중..." : "준비됨"
 */
// debounce 함수: 지정된 시간 동안 연속된 호출을 그룹화하여, 마지막 호출 이후 일정 시간이 지나면 함수를 실행합니다.
function debounce(func, wait, options) {
    // 함수 호출과 관련된 변수들을 초기화합니다.
    let lastArgs, lastThis, maxWait, result, timerId, lastCallTime;
    let lastInvokeTime = 0; // 마지막으로 함수가 실행된 시간
    let leading = false;    // 첫 호출에서 함수를 실행할지 여부
    let maxing = false;     // 최대 대기 시간을 설정할지 여부
    let trailing = true;    // 마지막 호출에서 함수를 실행할지 여부

    // requestAnimationFrame을 사용할지 여부를 결정합니다.
    // wait이 0이 아니거나 wait가 없으면 requestAnimationFrame을 사용합니다.
    const useRAF = !wait && wait !== 0 && typeof root.requestAnimationFrame === 'function';

    // func가 함수가 아니면 오류를 던집니다.
    if (typeof func !== 'function') {
        throw new TypeError('Expected a function');
    }

    // wait이 숫자가 아니면 0으로 설정합니다.
    wait = +wait || 0;

    // options가 객체가 아니면 빈 객체로 설정합니다.
if (isObject(options)) {
    // 'leading' 옵션 설정: 'leading' 키가 options 객체에 있으면 그 값을 boolean으로 변환합니다.
    // '!!' 연산자를 사용하여 truthy 값을 true로, falsy 값을 false로 변환합니다.
    leading = !!options.leading;

    // 'maxWait' 옵션 확인: options 객체에 'maxWait' 키가 있는지 확인합니다.
    // 'in' 연산자를 사용하여 해당 키의 존재 여부를 boolean 값으로 반환합니다.
    maxing = 'maxWait' in options;

    // 'maxWait' 값 설정: 'maxing'이 true이면, options 객체의 'maxWait' 값을 숫자로 변환하고,
    // 이 값과 'wait' 값을 비교하여 더 큰 값을 'maxWait'으로 설정합니다.
    // 'maxWait' 키가 없거나 값이 숫자가 아닌 경우, 기본적으로 0을 사용합니다.
    maxWait = maxing ? Math.max(+options.maxWait || 0, wait) : maxWait;

    // 'trailing' 옵션 설정: options 객체에 'trailing' 키가 있는지 확인하고,
    // 있으면 해당 값을 boolean으로 변환하여 'trailing' 변수에 할당합니다.
    // 키가 없는 경우 기존의 'trailing' 값을 그대로 사용합니다.
    trailing = 'trailing' in options ? !!options.trailing : trailing;
}

    // 실제 func를 호출하는 함수입니다.
    function invokeFunc(time) {
        const args = lastArgs;
        const thisArg = lastThis;

        lastArgs = lastThis = undefined;
        lastInvokeTime = time;
        result = func.apply(thisArg, args);
        return result;
    }

    // 대기 시간 동안 실행할 타이머를 설정하는 함수입니다.
    function startTimer(pendingFunc, milliseconds) {
        if (useRAF) {
            root.cancelAnimationFrame(timerId);
            return root.requestAnimationFrame(pendingFunc);
        }
        return setTimeout(pendingFunc, milliseconds);
    }

    // 설정된 타이머를 취소하는 함수입니다.
    function cancelTimer(id) {
        if (useRAF) {
            root.cancelAnimationFrame(id);
            return;
        }
        clearTimeout(id);
    }

    // 대기 시간이 시작될 때 호출되는 함수입니다.
    function leadingEdge(time) {
        lastInvokeTime = time;
        timerId = startTimer(timerExpired, wait);
        return leading ? invokeFunc(time) : result;
    }

    // 다음 호출까지 남은 대기 시간을 계산하는 함수입니다.
    function remainingWait(time) {
        const timeSinceLastCall = time - lastCallTime;
        const timeSinceLastInvoke = time - lastInvokeTime;
        const timeWaiting = wait - timeSinceLastCall;

        return maxing ? Math.min(timeWaiting, maxWait - timeSinceLastInvoke) : timeWaiting;
    }

    // 함수를 호출해야 하는지 여부를 결정하는 함수입니다.
    function shouldInvoke(time) {
        const timeSinceLastCall = time - lastCallTime;
        const timeSinceLastInvoke = time - lastInvokeTime;

        return (
            lastCallTime === undefined ||
            timeSinceLastCall >= wait ||
            timeSinceLastCall < 0 ||
            (maxing && timeSinceLastInvoke >= maxWait)
        );
    }

    // 타이머가 만료되었을 때 호출되는 함수입니다.
    function timerExpired() {
        const time = Date.now();
        if (shouldInvoke(time)) {
            return trailingEdge(time);
        }
        timerId = startTimer(timerExpired, remainingWait(time));
        return undefined;
    }

    // 대기 시간이 끝날 때 호출되는 함수입니다.
    function trailingEdge(time) {
        timerId = undefined;

        if (trailing && lastArgs) {
            return invokeFunc(time);
        }
        lastArgs = lastThis = undefined;
        return result;
    }

  // 취소 함수: 디바운스된 함수의 현재 대기 중인 타이머를 취소합니다.
function cancel() {
    if (timerId !== undefined) {
        cancelTimer(timerId); // 설정된 타이머를 취소합니다.
    }
    // 모든 변수를 초기 상태로 재설정합니다.
    lastInvokeTime = 0;
    lastArgs = lastCallTime = lastThis = timerId = undefined;
}

// 플러시 함수: 현재 대기 중인 함수 호출을 즉시 실행합니다.
function flush() {
    return timerId === undefined ? result : trailingEdge(Date.now());
    // timerId가 설정되지 않았다면 이전 결과를 반환, 설정되었다면 trailingEdge 함수를 호출하여 현재 대기 중인 함수를 실행합니다.
}

// 보류 중인지 확인하는 함수: 디바운스된 함수가 현재 대기 중인지 여부를 반환합니다.
function pending() {
    return timerId !== undefined; // timerId가 설정되어 있다면 대기 중인 것으로 간주합니다.
}

// 디바운스된 함수: 주어진 함수를 디바운스 처리하여 반환합니다.
function debounced(...args) {
    const time = Date.now();
    const isInvoking = shouldInvoke(time); // 현재 시간 기준으로 함수를 호출해야 하는지 판단합니다.

    lastArgs = args; // 마지막 인자 저장
    lastThis = this; // 마지막 this 컨텍스트 저장
    lastCallTime = time; // 마지막 호출 시간 저장

    if (isInvoking) {
        if (timerId === undefined) {
            return leadingEdge(lastCallTime); // 타이머가 설정되지 않았다면, leadingEdge를 호출합니다.
        }
        if (maxing) {
            // 최대 대기 시간이 설정된 경우, 타이머를 재설정하고 함수를 호출합니다.
            timerId = startTimer(timerExpired, wait);
            return invokeFunc(lastCallTime);
        }
    }
    if (timerId === undefined) {
        timerId = startTimer(timerExpired, wait); // 타이머 설정
    }
    return result; // 현재 결과 반환
}

// 취소, 플러시, 보류 중인지 확인하는 메서드를 디바운스된 함수에 추가합니다.
debounced.cancel = cancel;
debounced.flush = flush;
debounced.pending = pending;

return debounced; // 디바운스 처리된 함수 반환
}

export default debounce;