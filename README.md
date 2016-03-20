# eventstream

![TravisCI](https://travis-ci.org/Lapple/eventstream.svg)

Compact event stream library, that provides a first-class abstraction for a certain event that occurs repeatedly over time.

## Example

```js
var eventstream = require('./eventstream');

// Creating an event stream.
var seconds = eventstream(function(handler) {
    var timer = setInterval(handler, 1000);

    return function() {
        clearInterval(timer);
    };
});

// Using it later:
seconds
    // Play snare sound every beat.
    .map(snare)
    .merge(
        // Add delayed kicks.
        seconds
            .delay(10)
            .map(kick)
    )
    .merge(
        // Play piano sequence every four beats.
        seconds
            .scan(0, function(counter) {
                return counter + 1;
            })
            .filter(function(counter) {
                return counter % 4 === 0;
            })
            .map(piano)
    )
    .subscribe(playSound);
```

## API

### `eventstream(subscriptor)`

Returns an event stream instance, `subscriptor` is a function that receives a
handler function, implements a subscription and should return a function, that
implements unsubscription, for example:

```js
var clicks = eventstream(function(handler) {
    document.addEventListener('click', handler);

    return function unsubscribe() {
        document.removeEventListener('click', handler);
    };
});
```

`subscriptor` is not called until `.subscribe` is called on event stream instance.
The returned unsubscribe function is guaranteed to be called only once per
corresponding subscription.

### Subscription

#### `.subscribe(onNext, [onEnd])`

Subscribes `onNext` function to the stream updates, returns unsubscribe
function. `onNext` is going to be invoked on each stream tick with the tick's
value. Optional `onEnd` function is going to be called when the stream exhausts:

```js
clicks.subscribe(function(e) {
    console.log('Element clicked', e.target);
});
```

### Transformation

Available methods:

- `map`
- `scan`
- `filter`
- `delay`
- `diff`
- `take`
- `merge`
- `takeUntil`
- `combineLatest`
- `sampledBy`
- `flatMap`
- `flatMapLatest`

Note that transformation functions are not called unless the stream has at least
one active listener.

#### `.map(transform)`

Returns a new event stream with `transform` function applied to it's current
value:

```js
clicks.map(Date.now).subscribe(function(timestamp) {
    console.log('Click occured on', timestamp);
});
```

#### `.scan(seed, accumulate)`

Returns a new stream that would reduce the stream value by applying `accumulate`
function and emit the result on each tick:

```js
var counter = clicks.scan(0, function(count) {
    return count + 1;
});
```

#### `.filter(predicate)`

Returns a new stream, whose values propagate depending on `predicate` outcome:

```js
counter
    .filter(function(count) {
        return count % 2 === 0;
    })
    .subscribe(function(count) {
        console.log('Clicked second time');
    });
```

#### `.delay(timeout)`

Returns a new stream, whose ticks are delayed by a certain `timeout`.

```js
clicks
    .delay(2000)
    .subscribe(function() {
        console.log('Two seconds later.');
    });
```

#### `.diff(seed, comparator)`

Returns a new stream, whose values are the result of continuous application
of `comparator` function to two successive source stream values:

```js
clicks
    .map(function(e) {
        return e.target;
    })
    .diff(document.body, function(a, b) {
        return a.contains(b);
    })
    .subscribe(function(isDescendant) {
        console.log(isDescendant ? 'Clicking in' : 'Clicking out');
    });
```

#### `.take(count)`

Returns a new stream that will exhaust immediately after propagating `count`
ticks:

```js
clicks
    .take(1)
    .subscribe(
        function(e) {
            console.log('Clicked once');
        },
        function() {
            console.log('Done!');
        }
    );
```

#### `.merge(other)`

Returns a new stream that is going to project the ticks of both source stream
and `other` stream onto a single timeline:

```js
var clickTargets = clicks.map(function(e) {
    return e.target;
});

var plusClicks = clickTargets.filter(function(element) {
    return element.matches('.js-plus');
});

var minusClicks = clickTargets.filter(function(element) {
    return element.matches('.js-minus');
});

plusClicks
    .map(function() { return 1; })
    .merge(
        minusClicks.map(function() { return -1; })
    )
    .scan(0, function(count, delta) {
        return count + delta;
    })
    .subscribe(function(count) {
        console.log('Current counter value', count);
    });
```

#### `.takeUntil(other)`

Returns a new stream that is going to exhaust on the first tick, received from
`other` stream:

```js
var closeClicks = clicks
    .map(function(e) { return e.target; })
    .filter(function(element) { return element.matches('.js-close-window') });

counter
    .takeUntil(closeClicks)
    .subscribe(function(count) {
        console.log('Count while window is open', count);
    });
```

#### `.combineLatest(other, combinator)`

Returns a new stream that will emit a value, returned by `combinator` function,
on ticks from both source and `other` streams once both of them produce a value:

```js
var colorChanges = changeEvents.filter(function(e) {
    return e.target.matches('.js-color');
});

var sizeChanges = changeEvents.filter(function(e) {
    return e.target.matches('.js-size');
});

var getTargetValue = function(e) {
    return e.target.value;
};

var colors = colorChanges.map(getTargetValue);
var sizes = sizeChanges.map(getTargetValue);

colors
    .combineLatest(sizes, function(color, size) {
        return { size: size, color: color };
    })
    .subscribe(function(options) {
        console.log(
            'Selected color is', options.color,
            'selected size is', options.size
        )
    });
```

#### `.sampledBy(other)`

Returns a new stream that is going to emit source stream values, as they were
observed on `other` stream ticks:

```js
filterSettings
    .sampledBy(formSubmissions)
    .take(1)
    .subscribe(function(settings) {
        console.log('Submitted filter settings', settings);
    });
```

#### `.flatMap(fn)`

Returns a new stream that expects `fn` to produce a new event stream on each
source stream tick and then merges all these newly-produced streams onto a
single timeline:

```js
userConnections
    .flatMap(function(user) {
        return eventstream(function(handler) {
            var onMessage = function(text) {
                handler({
                    user: user,
                    text: text
                });
            };

            user.addEventListener('message', onMessage);

            return function() {
                user.removeEventListener('message', onMessage);
            };
        });
    })
    .subscribe(function(message) {
        console.log(message.user.name, ':', message.text);
    });
```
