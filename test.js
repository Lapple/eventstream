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
            it('should accept event propagation until first truthy predicate result', function(done) {
                const spy = sinon.spy();

                this.streamA
                    .scan(0, counter => counter + 1)
                    .takeUntil(counter => counter > 2)
                    .subscribe(
                        spy,
                        () => {
                            assert(spy.callCount === 2);
                            assert(spy.getCall(0).calledWith(1));
                            assert(spy.getCall(1).calledWith(2));
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
                        this.streamB.scan('', letter =>`${letter}B`),
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
                        this.streamB.scan('', letter =>`${letter}B`),
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
    });
});
