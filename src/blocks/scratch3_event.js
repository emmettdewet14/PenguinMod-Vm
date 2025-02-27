const Cast = require('../util/cast');
const SandboxRunner = require('../util/sandboxed-javascript-runner.js');

class Scratch3EventBlocks {
    constructor (runtime) {
        /**
         * The runtime instantiating this block package.
         * @type {Runtime}
         */
        this.runtime = runtime;

        this.runtime.on('KEY_PRESSED', key => {
            this.runtime.startHats('event_whenkeypressed', {
                KEY_OPTION: key
            });
            this.runtime.startHats('event_whenkeypressed', {
                KEY_OPTION: 'any'
            });
        });

        this.runtime.on('KEY_HIT', key => {
            this.runtime.startHats('event_whenkeyhit', {
                KEY_OPTION: key
            });
            this.runtime.startHats('event_whenkeyhit', {
                KEY_OPTION: 'any'
            });
        });

        this.isStarting = false;
        this.runtime.on('PROJECT_START_BEFORE_RESET', () => {
            // we need to remember that the project is starting
            // otherwise the stop block will run when flag is clicked
            this.isStarting = true;
        })
        this.runtime.on('PROJECT_STOP_ALL', () => {
            // if green flag is clicked, dont bother starting the hat
            if (this.isStarting) {
                this.isStarting = false;
                return;
            }
            // we need to wait for runtime to step once
            // otherwise the hat will be stopped as soon as it starts
            this.runtime.once('RUNTIME_STEP_START', () => {
                this.runtime.startHats('event_whenstopclicked');
            })
            this.isStarting = false;
        })
        this.runtime.on('RUNTIME_STEP_START', () => {
            this.runtime.startHats('event_always');
        })
    }

    /**
     * Retrieve the block primitives implemented by this package.
     * @return {object.<string, Function>} Mapping of opcode to Function.
     */
    getPrimitives () {
        return {
            event_whenanything: this.whenanything,
            event_whenjavascript: this.whenjavascript,
            event_whentouchingobject: this.touchingObject,
            event_broadcast: this.broadcast,
            event_broadcastandwait: this.broadcastAndWait,
            event_whengreaterthan: this.hatGreaterThanPredicate
        };
    }

    whenanything (args) {
        return Boolean(args.ANYTHING || false);
    }

    whenjavascript (args) {
        return new Promise((resolve, reject) => {
            const js = Cast.toString(args.JS);
            SandboxRunner.execute(js).then(result => {
                resolve(result.value === true)
            })
        })
    }

    getHats () {
        return {
            event_whenflagclicked: {
                restartExistingThreads: true
            },
            event_whenstopclicked: {
                restartExistingThreads: true
            },
            event_always: {
                restartExistingThreads: false
            },
            event_whenkeypressed: {
                restartExistingThreads: false
            },
            event_whenkeyhit: {
                restartExistingThreads: false
            },
            event_whenmousescrolled: {
                restartExistingThreads: false
            },
            event_whenanything: {
                restartExistingThreads: false,
                edgeActivated: true
            },
            event_whenjavascript: {
                restartExistingThreads: false,
                edgeActivated: true
            },
            event_whenthisspriteclicked: {
                restartExistingThreads: true
            },
            event_whentouchingobject: {
                restartExistingThreads: false,
                edgeActivated: true
            },
            event_whenstageclicked: {
                restartExistingThreads: true
            },
            event_whenbackdropswitchesto: {
                restartExistingThreads: true
            },
            event_whengreaterthan: {
                restartExistingThreads: false,
                edgeActivated: true
            },
            event_whenbroadcastreceived: {
                restartExistingThreads: true
            }
        };
    }

    touchingObject (args, util) {
        return util.target.isTouchingObject(args.TOUCHINGOBJECTMENU);
    }

    hatGreaterThanPredicate (args, util) {
        const option = Cast.toString(args.WHENGREATERTHANMENU).toLowerCase();
        const value = Cast.toNumber(args.VALUE);
        switch (option) {
        case 'timer':
            return util.ioQuery('clock', 'projectTimer') > value;
        case 'loudness':
            return this.runtime.audioEngine && this.runtime.audioEngine.getLoudness() > value;
        }
        return false;
    }

    broadcast (args, util) {
        const broadcastVar = util.runtime.getTargetForStage().lookupBroadcastMsg(
            args.BROADCAST_OPTION.id, args.BROADCAST_OPTION.name);
        if (broadcastVar) {
            const broadcastOption = broadcastVar.name;
            util.startHats('event_whenbroadcastreceived', {
                BROADCAST_OPTION: broadcastOption
            });
        }
    }

    broadcastAndWait (args, util) {
        if (!util.stackFrame.broadcastVar) {
            util.stackFrame.broadcastVar = util.runtime.getTargetForStage().lookupBroadcastMsg(
                args.BROADCAST_OPTION.id, args.BROADCAST_OPTION.name);
        }
        if (util.stackFrame.broadcastVar) {
            const broadcastOption = util.stackFrame.broadcastVar.name;
            // Have we run before, starting threads?
            if (!util.stackFrame.startedThreads) {
                // No - start hats for this broadcast.
                util.stackFrame.startedThreads = util.startHats(
                    'event_whenbroadcastreceived', {
                        BROADCAST_OPTION: broadcastOption
                    }
                );
                if (util.stackFrame.startedThreads.length === 0) {
                    // Nothing was started.
                    return;
                }
            }
            // We've run before; check if the wait is still going on.
            const instance = this;
            // Scratch 2 considers threads to be waiting if they are still in
            // runtime.threads. Threads that have run all their blocks, or are
            // marked done but still in runtime.threads are still considered to
            // be waiting.
            const waiting = util.stackFrame.startedThreads
                .some(thread => instance.runtime.threads.indexOf(thread) !== -1);
            if (waiting) {
                // If all threads are waiting for the next tick or later yield
                // for a tick as well. Otherwise yield until the next loop of
                // the threads.
                if (
                    util.stackFrame.startedThreads
                        .every(thread => instance.runtime.isWaitingThread(thread))
                ) {
                    util.yieldTick();
                } else {
                    util.yield();
                }
            }
        }
    }
}

module.exports = Scratch3EventBlocks;
