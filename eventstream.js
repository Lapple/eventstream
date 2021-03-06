var EXHAUST_SIGNAL = {};
var NO_VALUE = {};

var constant = partial(partial, identity);

function eventstream(subscriptor, scheduler) {
    if (!scheduler) {
        // Simplified from:
        //
        //     scheduler = function(next, nextError) {
        //         return function(value) {
        //             return next(value);
        //         }
        //     };
        //
        scheduler = identity;
    }

    function map(fn) {
        return transformScheduler(function(next, nextError, value) {
            try {
                next(fn(value));
            } catch(e) {
                nextError(e);
            }
        });
    }

    function filter(predicate) {
        return transformScheduler(function(next, nextError, value) {
            try {
                if (predicate(value)) {
                    next(value);
                }
            } catch(e) {
                nextError(e);
            }
        });
    }

    function scan(seed, fn) {
        var s = seed;

        return transformScheduler(function(next, nextError, value) {
            try {
                s = fn(s, value);
                next(s);
            } catch(e) {
                nextError(e);
            }
        });
    }

    function diff(start, fn) {
        var s = start;

        return transformScheduler(function(next, nextError, value) {
            try {
                next(fn(s, value));
                s = value;
            } catch(e) {
                nextError(e);
            }
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
            composeScheduler(function(next, nextError, value) {
                timer = setTimeout(partial(next, value), timeout);
            })
        );
    }

    function take(count) {
        return transformScheduler(function(next, nextError, value) {
            if (--count >= 0) {
                next(value);

                if (count === 0) {
                    next(EXHAUST_SIGNAL);
                }
            }
        });
    }

    function merge(other) {
        function transform(next, nextError, value) {
            next(value);
        }

        return combineWithEventStream(other, transform, transform);
    }

    function combineLatest(other, combinator) {
        var values = {};

        function transform(property, next, nextError, value) {
            values[property] = value;

            if ('a' in values && 'b' in values) {
                try {
                    next(combinator(values.a, values.b));
                } catch(e) {
                    nextError(e);
                }
            }
        }

        return combineWithEventStream(
            other,
            partial(transform, 'a'),
            partial(transform, 'b')
        );
    }

    function sampledBy(other) {
        var v = NO_VALUE;

        return combineWithEventStream(
            other,
            function(next, nextError, value) {
                v = value;
            },
            function(next) {
                if (v !== NO_VALUE) {
                    next(v);
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

    function flatMapCapped(limit, fn) {
        var substreams = [];

        return eventstream(
            joinSubscriptors(
                constant(function() {
                    while (substreams.length) {
                        substreams.shift()();
                    }
                }),
                subscriptor
            ),
            composeScheduler(function(next, nextError, value) {
                if (substreams.length >= limit) {
                    substreams.shift()();
                }

                substreams.push(
                    fn(value).subscribe(next, null, nextError)
                );
            })
        );
    }

    function subscribe(onNext, onEnd, onError) {
        var canUnsubscribe = true;

        var unsubscribe = subscriptor(
            scheduler(
                function(value) {
                    if (value === EXHAUST_SIGNAL) {
                        if (canUnsubscribe) {
                            canUnsubscribe = false;
                            unsubscribe();
                        }
                        if (onEnd) {
                            onEnd();
                        }
                    } else {
                        onNext(value);
                    }
                },
                function(error) {
                    if (onError) {
                        onError(error);
                    } else {
                        throw error;
                    }
                }
            )
        );

        return unsubscribe;
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

        flatMap: partial(flatMapCapped, Infinity),
        flatMapLatest: partial(flatMapCapped, 1),

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
        return function(next, nextError) {
            return scheduler(
                partial(partial(fn, next), nextError),
                nextError
            );
        };
    }

    function combineWithEventStream(other, transformA, transformB) {
        return other.decompose(function(otherSubscriptor, otherScheduler) {
            return eventstream(
                joinSubscriptors(
                    subscriptor,
                    otherSubscriptor
                ),
                function(next, nextError) {
                    return function(self, value) {
                        if (self) {
                            scheduler(
                                partial(partial(transformA, next), nextError),
                                nextError
                            )(value);
                        } else {
                            otherScheduler(
                                partial(partial(transformB, next), nextError),
                                nextError
                            )(value);
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
    return function(a, b, c) {
        var arity = arguments.length;

        return (
            (arity > 2) ? fn(argument, a, b, c) :
            (arity > 1) ? fn(argument, a, b) :
            (arity > 0) ? fn(argument, a) : fn(argument)
        );
    };
}

function identity(x) {
    return x;
}

module.exports = eventstream;
