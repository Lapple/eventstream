var EXHAUST_SIGNAL = {};

function eventstream(subscriptor, scheduler) {
    if (typeof scheduler !== 'function') {
        scheduler = identity;
    }

    function map(fn) {
        return transformScheduler(function(next, value) {
            next(fn(value));
        });
    }

    function filter(predicate) {
        return transformScheduler(function(next, value) {
            if (predicate(value)) {
                next(value);
            }
        });
    }

    function scan(seed, fn) {
        var s = seed;

        return transformScheduler(function(next, value) {
            s = fn(s, value);
            next(s);
        });
    }

    function takeUntil(predicate) {
        return transformScheduler(function(next, value) {
            next(predicate(value) ? EXHAUST_SIGNAL : value);
        });
    }

    function merge(another) {
        function transform(next, value) {
            next(value);
        }

        return combineWithEventStream(another, transform, transform);
    }

    function combineLatest(another, combinator) {
        var values = {};

        function transform(self, next, value) {
            values[self ? 'a' : 'b'] = value;

            if ('a' in values && 'b' in values) {
                next(combinator(values.a, values.b));
            }
        }

        return combineWithEventStream(
            another,
            partial(transform, true),
            partial(transform, false)
        );
    }

    function flatMap(fn) {
        var substreams = [];

        return eventstream(
            function(handler) {
                var unsubscribe = subscriptor(handler);

                return function() {
                    invokeEach(substreams);
                    unsubscribe();
                };
            },
            function(next) {
                return scheduler(function(value) {
                    substreams.push(
                        fn(value).subscribe(next)
                    );
                });
            }
        );
    }

    function take(count) {
        return takeUntil(function() {
            return count-- === 0;
        });
    }

    function subscribe(onNext) {
        var unsubscribeOnce = once(
            subscriptor(
                scheduler(function(value) {
                    if (value === EXHAUST_SIGNAL) {
                        unsubscribeOnce();
                    } else {
                        onNext(value);
                    }
                })
            )
        );

        return unsubscribeOnce;
    }

    return {
        map: map,
        filter: filter,
        takeUntil: takeUntil,
        scan: scan,

        merge: merge,
        combineLatest: combineLatest,

        flatMap: flatMap,

        take: take,

        subscribe: subscribe,

        // FIXME: Make these read-only.
        subscriptor: subscriptor,
        scheduler: scheduler
    };

    function transformScheduler(transform) {
        return eventstream(
            subscriptor,
            function(next) {
                return scheduler(function(value) {
                    transform(next, value);
                });
            }
        );
    }

    function combineWithEventStream(another, transformA, transformB) {
        return eventstream(
            joinSubscriptors(
                subscriptor,
                another.subscriptor
            ),
            function(next) {
                return function(index, value) {
                    if (index === 0) {
                        scheduler(partial(transformA, next))(value);
                    } else {
                        another.scheduler(partial(transformB, next))(value);
                    }
                };
            }
        );
    }
}

function joinSubscriptors(a, b) {
    return function(handler) {
        var unsubscribeFromA = a(partial(handler, 0));
        var unsubscribeFromB = b(partial(handler, 1));

        return function() {
            unsubscribeFromA();
            unsubscribeFromB();
        };
    };
}

function partial(fn, argument) {
    // FIXME: Pass all arguments.
    return function(a, b) {
        fn(argument, a, b);
    };
}

function once(fn) {
    var called = false;

    return function() {
        if (!called) {
            called = true;
            fn();
        }
    };
}

function invokeEach(array) {
    for (var i = 0, len = array.length; i < len; i += 1) {
        array[i]();
    }
}

function identity(x) {
    return x;
}

module.exports = eventstream;
