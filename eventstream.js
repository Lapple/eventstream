var EXHAUST_SIGNAL = {};

var constant = partial(partial, identity);

function eventstream(subscriptor, scheduler) {
    if (!scheduler) {
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

        return map(function(value) {
            s = fn(s, value);
            return s;
        });
    }

    function diff(start, fn) {
        var s = start;

        return transformScheduler(function(next, value) {
            next(fn(s, value));
            s = value;
        });
    }

    function delay(timeout) {
        var timer;

        return eventstream(
            joinSubscriptors(
                constant(function() {
                    clearTimeout(timer);
                }),
                subscriptor
            ),
            composeScheduler(function(next, value) {
                timer = setTimeout(partial(next, value), timeout);
            })
        );
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

    function merge(other) {
        function transform(next, value) {
            next(value);
        }

        return combineWithEventStream(other, transform, transform);
    }

    function combineLatest(other, combinator) {
        var values = {};

        function transform(self, next, value) {
            values[self ? 'a' : 'b'] = value;

            if ('a' in values && 'b' in values) {
                next(combinator(values.a, values.b));
            }
        }

        return combineWithEventStream(
            other,
            partial(transform, true),
            partial(transform, false)
        );
    }

    function sampledBy(other) {
        var container = {};

        return combineWithEventStream(
            other,
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

    function takeUntil(other) {
        return merge(
            other.map(
                constant(EXHAUST_SIGNAL)
            )
        );
    }

    function flatMap(fn) {
        var substreams = [];

        return eventstream(
            joinSubscriptors(
                constant(
                    partial(invokeEach, substreams)
                ),
                subscriptor
            ),
            composeScheduler(function(next, value) {
                substreams.push(
                    fn(value).subscribe(next)
                );
            })
        );
    }

    function flatMapLatest(fn) {
        var substream;

        function unsubscribeSubstream() {
            if (substream) {
                substream();
            }
        }

        return eventstream(
            joinSubscriptors(
                constant(unsubscribeSubstream),
                subscriptor
            ),
            composeScheduler(function(next, value) {
                unsubscribeSubstream();
                substream = fn(value).subscribe(next);
            })
        );
    }

    function subscribe(onNext, onEnd) {
        var unsubscribeOnce = once(
            subscriptor(
                scheduler(function(value) {
                    if (value === EXHAUST_SIGNAL) {
                        unsubscribeOnce();
                        if (onEnd) {
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
        delay: delay,
        diff: diff,

        takeUntil: takeUntil,
        take: take,

        merge: merge,
        combineLatest: combineLatest,
        sampledBy: sampledBy,

        flatMap: flatMap,
        flatMapLatest: flatMapLatest,

        subscribe: subscribe,
        decompose: decompose
    };

    function transformScheduler(transform) {
        return eventstream(
            subscriptor,
            composeScheduler(transform)
        );
    }

    function composeScheduler(fn) {
        return function(next) {
            return scheduler(partial(fn, next));
        }
    }

    function combineWithEventStream(other, transformA, transformB) {
        return other.decompose(function(otherSubscriptor, otherScheduler) {
            return eventstream(
                joinSubscriptors(
                    subscriptor,
                    otherSubscriptor
                ),
                function(next) {
                    return function(self, value) {
                        if (self) {
                            scheduler(partial(transformA, next))(value);
                        } else {
                            otherScheduler(partial(transformB, next))(value);
                        }
                    };
                }
            );
        });
    }
}

function joinSubscriptors(a, b) {
    return function(handler) {
        var unsubscribeFromA = a(partial(handler, true));
        var unsubscribeFromB = b(partial(handler, false));

        return function() {
            unsubscribeFromA();
            unsubscribeFromB();
        };
    };
}

function partial(fn, argument) {
    // FIXME: Pass all arguments.
    return function(a, b) {
        return fn(argument, a, b);
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
