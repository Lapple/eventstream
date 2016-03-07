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
