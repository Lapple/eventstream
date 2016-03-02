var EXHAUST_SIGNAL = {};

var TRUE = true;
var FALSE = false;

function eventstream(subscriptor, scheduler) {
    if (!isFunction(scheduler)) {
        scheduler = function(next) {
            return next;
        };
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

        return map(function(value) {
            s = fn(s, value);
            return s;
        });
    }

    function takeUntil(predicate) {
        return map(function(value) {
            return predicate(value) ? EXHAUST_SIGNAL : value;
        });
    }

    function take(count) {
        return transformScheduler(function(next, value) {
            if (--count >= 0) {
                next(value);

                if (count === 0) {
                    next(EXHAUST_SIGNAL);
                }
            }
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
            partial(transform, TRUE),
            partial(transform, FALSE)
        );
    }

    function sampledBy(another) {
        var container = {};

        return combineWithEventStream(
            another,
            function(next, value) {
                container.v = value;
            },
            function(next) {
                if ('v' in container) {
                    next(container.v);
                }
            }
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

    function subscribe(onNext, onEnd) {
        var unsubscribeOnce = once(
            subscriptor(
                scheduler(function(value) {
                    if (value === EXHAUST_SIGNAL) {
                        unsubscribeOnce();
                        if (isFunction(onEnd)) {
                            onEnd();
                        }
                    } else {
                        onNext(value);
                    }
                })
            )
        );

        return unsubscribeOnce;
    }

    function decompose(getter) {
        return getter(subscriptor, scheduler);
    }

    return {
        map: map,
        filter: filter,
        scan: scan,

        takeUntil: takeUntil,
        take: take,

        merge: merge,
        combineLatest: combineLatest,
        sampledBy: sampledBy,

        flatMap: flatMap,

        subscribe: subscribe,
        decompose: decompose
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
        return another.decompose(function(anotherSubscriptor, anotherScheduler) {
            return eventstream(
                joinSubscriptors(
                    subscriptor,
                    anotherSubscriptor
                ),
                function(next) {
                    return function(self, value) {
                        if (self) {
                            scheduler(partial(transformA, next))(value);
                        } else {
                            anotherScheduler(partial(transformB, next))(value);
                        }
                    };
                }
            );
        });
    }
}

function joinSubscriptors(a, b) {
    return function(handler) {
        var unsubscribeFromA = a(partial(handler, TRUE));
        var unsubscribeFromB = b(partial(handler, FALSE));

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

function isFunction(fn) {
    return typeof fn === 'function';
}

module.exports = eventstream;
