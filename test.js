const assert = require('assert');
const sinon = require('sinon');

const eventstream = require('./eventstream');

describe('eventstream', () => {
    beforeEach(function() {
        this.clock = sinon.useFakeTimers();

        this.streamA = eventstream(handler => {
            const timer = setInterval(handler, 10);
            return () => clearInterval(timer);
        });

        this.streamB = eventstream(handler => {
            const timer = setInterval(handler, 15);
            return () => clearInterval(timer);
        });
    });

    afterEach(function() {
        this.clock.restore();
    });

    describe('behaviour', () => {
        describe('subscriptor', () => {
            it('should never be called unless there are subscriptions', function() {
                const spy = sinon.spy();
                const stream = eventstream(spy)
                    .scan(0, count => count + 1)
                    .map(Date.now);

                this.clock.tick(100);

                assert(spy.callCount === 0);
            });

            it('should have its unsubscribe callback called on stream exhaust', function() {
                const spy = sinon.spy();

                const stream = eventstream(handler => {
                    const timer = setInterval(handler, 10);

                    return () => {
                        clearInterval(timer);
                        spy();
                    }
                });

                stream
                    .map(Date.now)
                    .take(10)
                    .subscribe(() => {});

                this.clock.tick(200);

                assert(spy.callCount === 1);
            });
        });
    });

    describe('methods', () => {
        describe('.map', () => {
            it('should synchronously transform incoming value into another', function(done) {
                this.streamA
                    .map(() => 'ok')
                    .take(1)
                    .subscribe(
                        value => assert(value === 'ok'),
                        done
                    );

                this.clock.tick(100);
            });
        });

        describe('.scan', () => {
            it('should continuously apply accumulator on current value while propagating each tick', function(done) {
                const spy = sinon.spy();

                this.streamA
                    .scan(0, counter => counter + 1)
                    .take(3)
                    .subscribe(
                        spy,
                        () => {
                            assert(spy.callCount === 3);
                            assert(spy.getCall(0).calledWith(1));
                            assert(spy.getCall(1).calledWith(2));
                            assert(spy.getCall(2).calledWith(3));
                            done();
                        }
                    );

                this.clock.tick(100);
            });
        });

        describe('.diff', () => {
            it('should continuously emit the result of difference function applied to two consecutive ticks', function(done) {
                const spy = sinon.spy();

                this.streamA
                    .scan(0, counter => counter + 2)
                    .diff(0, (a, b) => Math.abs(a - b))
                    .take(3)
                    .subscribe(
                        spy,
                        () => {
                            assert(spy.callCount === 3);
                            assert(spy.getCall(0).calledWith(2));
                            assert(spy.getCall(1).calledWith(2));
                            assert(spy.getCall(2).calledWith(2));
                            done();
                        }
                    );

                this.clock.tick(100);
            });
        });

        describe('.filter', () => {
            it('should accept or discard event propagation depending on predicate output', function(done) {
                const spy = sinon.spy();

                this.streamA
                    .scan(0, counter => counter + 1)
                    .filter(value => value % 2 === 0)
                    .take(2)
                    .subscribe(
                        spy,
                        () => {
                            assert(spy.callCount === 2);
                            assert(spy.getCall(0).calledWith(2));
                            assert(spy.getCall(1).calledWith(4));
                            done();
                        }
                    );

                this.clock.tick(100);
            });
        });

        describe('.takeUntil', () => {
            it('should accept event propagation until the passed eventstream ticks', function(done) {
                const spy = sinon.spy();

                this.streamA
                    .scan(0, counter => counter + 1)
                    .takeUntil(
                        this.streamB.delay(20)
                    )
                    .subscribe(
                        spy,
                        () => {
                            assert(spy.callCount === 3);
                            assert(spy.getCall(0).calledWith(1));
                            done();
                        }
                    );

                this.clock.tick(100);
            });
        });

        describe('.take', () => {
            it('should propagate ticks until it processes a certain amount', function(done) {
                const spy = sinon.spy();

                this.streamA
                    .scan(0, counter => counter + 1)
                    .take(3)
                    .subscribe(
                        spy,
                        () => {
                            assert(spy.callCount === 3);
                            assert(spy.getCall(0).calledWith(1));
                            assert(spy.getCall(1).calledWith(2));
                            assert(spy.getCall(2).calledWith(3));
                            done();
                        }
                    );

                this.clock.tick(100);
            });
        });

        describe('.delay', () => {
            it('should delay event propagation by a certain timeout', function(done) {
                const spy = sinon.spy();

                this.streamA
                    .delay(20)
                    .take(5)
                    .subscribe(spy, done);

                this.clock.tick(1);
                assert(spy.callCount === 0);

                this.clock.tick(20);
                assert(spy.callCount === 0);

                this.clock.tick(10);
                assert(spy.callCount === 1);

                this.clock.tick(10);
                assert(spy.callCount === 2);

                this.clock.tick(20);
                assert(spy.callCount === 4);

                this.clock.tick(50);
            });
        });

        describe('.merge', () => {
            it('should merge signals from two streams into one', function(done) {
                const spy = sinon.spy();

                this.streamA
                    .map(() => 'A')
                    .merge(
                        this.streamB.map(() => 'B')
                    )
                    .take(3)
                    .subscribe(
                        spy,
                        () => {
                            assert(spy.callCount === 3);
                            assert(spy.getCall(0).calledWith('A'));
                            assert(spy.getCall(1).calledWith('B'));
                            assert(spy.getCall(2).calledWith('A'));
                            done();
                        }
                    );

                this.clock.tick(100);
            });
        });

        describe('.combineLatest', () => {
            it('should combine signals from two streams into one', function(done) {
                const spy = sinon.spy();

                this.streamA
                    .scan('', letter => `${letter}A`)
                    .combineLatest(
                        this.streamB.scan('', letter => `${letter}B`),
                        (a, b) => `${a}-${b}`
                    )
                    .take(4)
                    .subscribe(
                        spy,
                        () => {
                            assert(spy.callCount === 4);
                            assert(spy.getCall(0).calledWith('A-B'));
                            assert(spy.getCall(1).calledWith('AA-B'));
                            assert(spy.getCall(2).calledWith('AAA-B'));
                            assert(spy.getCall(3).calledWith('AAA-BB'));
                            done();
                        }
                    );

                this.clock.tick(100);
            });
        });

        describe('.sampledBy', () => {
            it('should propagate target event stream ticks as sampled by passed stream', function(done) {
                const spy = sinon.spy();

                this.streamA
                    .scan('', letter => `${letter}A`)
                    .combineLatest(
                        this.streamB.scan('', letter => `${letter}B`),
                        (a, b) => `${a}-${b}`
                    )
                    .sampledBy(this.streamB)
                    .take(4)
                    .subscribe(
                        spy,
                        () => {
                            assert(spy.callCount === 4);
                            assert(spy.getCall(0).calledWith('A-B'));
                            assert(spy.getCall(1).calledWith('AAA-BB'));
                            assert(spy.getCall(2).calledWith('AAAA-BBB'));
                            assert(spy.getCall(3).calledWith('AAAAAA-BBBB'));
                            done();
                        }
                    );

                this.clock.tick(100);
            });
        });

        describe('.flatMap', () => {
            it('should project spawned event streams onto a single event stream', function(done) {
                const spy = sinon.spy();

                this.streamA
                    .scan(0, k => k + 1)
                    .flatMap(k => {
                        const e = eventstream(handler => {
                            const timer = setInterval(handler, 3);
                            return () => clearInterval(timer);
                        });

                        return e
                            .scan(0, j => j + 1)
                            .map(j => `${k}-${j}`);
                    })
                    .take(12)
                    .subscribe(
                        spy,
                        () => {
                            assert(spy.callCount === 12);
                            assert(spy.getCall(0).calledWith('1-1'));
                            assert(spy.getCall(1).calledWith('1-2'));
                            assert(spy.getCall(2).calledWith('1-3'));
                            assert(spy.getCall(3).calledWith('1-4'));
                            assert(spy.getCall(4).calledWith('2-1'));
                            assert(spy.getCall(5).calledWith('1-5'));
                            assert(spy.getCall(6).calledWith('2-2'));
                            assert(spy.getCall(7).calledWith('1-6'));
                            assert(spy.getCall(8).calledWith('2-3'));
                            assert(spy.getCall(9).calledWith('1-7'));
                            assert(spy.getCall(10).calledWith('2-4'));
                            assert(spy.getCall(11).calledWith('3-1'));
                            done();
                        }
                    );

                this.clock.tick(200);
            });

            it('should have child streams\' unsubscribe callback called on main stream exhaust', function(done) {
                const spySubscribe = sinon.spy();
                const spyUnsubscribe = sinon.spy();

                this.streamA
                    .flatMap(() => {
                        return eventstream(handler => {
                            const timer = setInterval(handler, 3);

                            spySubscribe();

                            return () => {
                                clearInterval(timer);
                                spyUnsubscribe();
                            }
                        });
                    })
                    .take(12)
                    .subscribe(
                        () => {},
                        () => {
                            assert(spySubscribe.callCount === 3);
                            assert(spyUnsubscribe.callCount === 3);
                            done();
                        }
                    );

                this.clock.tick(200);
            });
        });

        describe('.flatMapLatest', () => {
            it('should project latest spawned event stream onto a single event stream', function(done) {
                const spy = sinon.spy();

                this.streamA
                    .scan(0, k => k + 1)
                    .flatMapLatest(k => {
                        const e = eventstream(handler => {
                            const timer = setInterval(handler, 3);
                            return () => clearInterval(timer);
                        });

                        return e
                            .scan(0, j => j + 1)
                            .map(j => `${k}-${j}`);
                    })
                    .take(12)
                    .subscribe(
                        spy,
                        () => {
                            assert(spy.callCount === 12);
                            assert(spy.getCall(0).calledWith('1-1'));
                            assert(spy.getCall(1).calledWith('1-2'));
                            assert(spy.getCall(2).calledWith('1-3'));
                            assert(spy.getCall(3).calledWith('2-1'));
                            assert(spy.getCall(4).calledWith('2-2'));
                            assert(spy.getCall(5).calledWith('2-3'));
                            assert(spy.getCall(6).calledWith('3-1'));
                            assert(spy.getCall(7).calledWith('3-2'));
                            assert(spy.getCall(8).calledWith('3-3'));
                            assert(spy.getCall(9).calledWith('4-1'));
                            assert(spy.getCall(10).calledWith('4-2'));
                            assert(spy.getCall(11).calledWith('4-3'));
                            done();
                        }
                    );

                this.clock.tick(200);
            });

            it('should have child streams\' unsubscribe callback called on main stream exhaust', function(done) {
                const spySubscribe = sinon.spy();
                const spyUnsubscribe = sinon.spy();

                this.streamA
                    .flatMapLatest(() => {
                        return eventstream(handler => {
                            const timer = setInterval(handler, 3);

                            spySubscribe();

                            return () => {
                                clearInterval(timer);
                                spyUnsubscribe();
                            }
                        });
                    })
                    .take(12)
                    .subscribe(
                        () => {},
                        () => {
                            assert(spySubscribe.callCount === 4);
                            assert(spyUnsubscribe.callCount === 4);
                            done();
                        }
                    );

                this.clock.tick(200);
            });
        });
    });

    // TODO: More tests in this section.
    describe('error propagation', () => {
        it('should collect errors thrown in onError handler', function(done) {
            const spy = sinon.spy();

            this.streamA
                .scan(0, k => k + 1)
                .map(k => {
                    if (k % 2 === 0) {
                        return k;
                    } else {
                        throw new Error();
                    }
                })
                .take(2)
                .subscribe(
                    _ => _,
                    () => {
                        assert(spy.callCount === 2);
                        assert(spy.getCall(0).args.length === 1);
                        assert(spy.getCall(0).args[0] instanceof Error);
                        assert(spy.getCall(1).args.length === 1);
                        assert(spy.getCall(1).args[0] instanceof Error);
                        done();
                    },
                    spy
                );

            this.clock.tick(100);
        });

        it('should not call value-processing callbacks', function(done) {
            const spyBeforeError = sinon.spy();
            const spyAfterError = sinon.spy();

            this.streamA
                .map(spyBeforeError)
                .scan(0, k => k + 1)
                .map(k => {
                    if (k % 2 === 0) {
                        return k;
                    } else {
                        return namespace.UNDEFINED_VARIABLE;
                    }
                })
                .map(spyAfterError)
                .take(2)
                .subscribe(
                    _ => _,
                    () => {
                        assert(spyBeforeError.callCount === 4);
                        assert(spyAfterError.callCount === 2);
                        assert(spyAfterError.getCall(0).calledWith(2));
                        assert(spyAfterError.getCall(1).calledWith(4));
                        done();
                    },
                    _ => _
                );

            this.clock.tick(100);
        });
    });
});
