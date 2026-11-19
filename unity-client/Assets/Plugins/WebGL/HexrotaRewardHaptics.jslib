mergeInto(LibraryManager.library, {
    HexrotaPlayRewardHaptic: function (milliseconds) {
        if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
            navigator.vibrate(milliseconds);
        }
    }
});
