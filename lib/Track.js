var EMPTY = {};

// promise.fadeOut = function() {
//     var endTime = this.ctx.currentTime + fadeDuration;
//     gain.gain.linearRampToValueAtTime(0, endTime);
//     sourceNode.stop(endTime);
// }

var Track = module.exports = function(soundBox, opts) {
    
    opts = opts || EMPTY;

    this._soundBox      = soundBox;
    this._ctx           = soundBox.audioContext;
    this._buffers       = soundBox.sounds;
    this._maxPolyphony  = typeof opts.maxPolyphony === 'number' ? opts.maxPolyphony : null;
    this._exclusive     = opts.exclusive || false;
    this._direct        = !!opts.direct;
    this._playing       = [];

    if (this._exclusive) {
        this._playingIds = {};
    }

    if (this._direct) {
        
        this._target = this._ctx.destination;
    
    } else {

        this._gainNode = this._ctx.createGain();
        this._gainNode.connect(this._ctx.destination);
        this._gain = 1;
        this._muted = false;
        this._setGain(1);

        this._target = this._gainNode;

    }

}

//
// Gain

Track.prototype.mute = function() {
    if (!this._direct) {
        this._muted = true;
        this._setGain(0);    
    }
}

Track.prototype.unmute = function() {
    if (!this._direct) {
        this._muted = false;
        this._setGain(this._gain);    
    }
}

Track.prototype.setGain = function(gain) {
    if (!this._direct) {
        this._gain = gain;
        if (!this._muted) {
            this._setGain(this._gain);
        }    
    }
}

Track.prototype._setGain = function(gain) {
    this._gainNode.setValueAtTime(gain, this._ctx.currentTime);
}

//
//

Track.prototype.cancel = function() {

    // TODO: need a nice way of zapping them all
    
    this._playing = [];
    if (this._exclusive) {
        this._playingIds = {};
    }

}

Track.prototype.play = function(id, opts) {

    var buffer = this._buffers[id];
    if (!buffer) {
        throw new Error("unknown sound ID: " + id);
    }

    if (this._maxPolyphony) {
        while (this._playing.length >= this._maxPolyphony) {
            this._playing.shift().cancel();
        }
    }

    if (this._exclusive) {
        if (id in this._playingIds) {
            this._playingIds[id].cancel();
        }
    }

    var opts        = opts || EMPTY,
        ended       = false,
        sourceNode  = this._ctx.createBufferSource(),
        gainNode    = this._ctx.createGain(),
        gain        = typeof opts.gain === 'number' ? opts.gain : 1,
        resolve     = null,
        instance    = P(function(res) { resolve = res; });

    gainNode.gain.setValueAtTime(gain, this._ctx.currentTime);
    gainNode.connect(this._target);

    sourceNode.buffer = buffer;
    sourceNode.connect(gainNode);
 
    instance.cancel = function() {
        if (ended) return;
        sourceNode.stop(0);
        teardown();
    }

    var teardown = function() {
        
        if (ended) return;
        ended = true;
        
        gainNode.disconnect();
        sourceNode.disconnect();

        this._playing.splice(this._playing.indexOf(instance), 1);

        if (this._exclusive) {
            delete this._playingIds[id];
        }

        resolve();

    }.bind(this);

    this._playing.push(instance);

    if (this._exclusive) {
        this._playingIds[id] = instance;
    }

    sourceNode.onended = teardown;
    sourceNode.start(0);

    return instance;

}
