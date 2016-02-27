var assert = require('assert');
var sinon = require('sinon');

var eventstream = require('./eventstream');

describe('eventstream', () => {
    beforeEach(function() {
        this.stream = eventstream(handler => {
            const timer = setInterval(handler, 1);
            return () => clearInterval(timer);
        });
    });

    describe('.map', () => {
        it('should synchronously transform incoming value into another', function(done) {
            this.stream
                .map(() => 'ok')
                .take(1)
                .subscribe(
                    value => assert(value === 'ok'),
                    done
                );
        });
    });

    describe('.scan', () => {
        it('should continuously apply accumulator on current value while propagating each tick', function(done) {
            const spy = sinon.spy();

            this.stream
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
        });
    });

    describe('.filter', () => {
        it('should accept or discard event propagation depending on predicate output', function(done) {
            const spy = sinon.spy();

            this.stream
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
        });
    });

    describe('.takeUntil', () => {
        it('should accept event propagation until first truthy predicate result', function(done) {
            const spy = sinon.spy();

            this.stream
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
        });
    });

    describe('.take', () => {
        it('should propagate ticks until it processes a certain amount', function(done) {
            const spy = sinon.spy();

            this.stream
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
        });
    });
});
