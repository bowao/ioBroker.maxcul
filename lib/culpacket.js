module.exports = function(env) {
    let CulPacket;

    return CulPacket = (function() {
        function CulPacket() {
            this.length = 0;
            this.messageCount = 0;
            this.flag = 0;
            this.groupid = 0;
            this.source = '';
            this.dest = '';
            this.rawType = '';
            this.rawPayload = '';
            this.forMe = false;
            this.command = '';
            this.status = 'new';
            this.rawPacket = '';
            this.rawPayload = '';
            this.sendTries = 0;
            this.getCredits = false;
            this.credits = null;
            this.credits1 = null;
            this.decodedPayload = null;
        }

        CulPacket.prototype.isCredits = function() {
            return this.getCredits;
        };

        CulPacket.prototype.getLength = function() {
            return this.length;
        };

        CulPacket.prototype.setLength = function(length) {
            return this.length = length;
        };

        CulPacket.prototype.getMessageCount = function() {
            return this.messageCount;
        };

        CulPacket.prototype.setMessageCount = function(messageCount) {
            return this.messageCount = messageCount;
        };

        CulPacket.prototype.getFlag = function() {
            return this.flag;
        };

        CulPacket.prototype.setFlag = function(flag) {
            return this.flag = flag;
        };

        CulPacket.prototype.getGroupId = function() {
            return this.groupid;
        };

        CulPacket.prototype.setGroupId = function(groupid) {
            return this.groupid = groupid;
        };

        CulPacket.prototype.getSource = function() {
            return this.source;
        };

        CulPacket.prototype.setSource = function(source) {
            return this.source = source.toLowerCase();
        };

        CulPacket.prototype.getDest = function() {
            return this.dest;
        };

        CulPacket.prototype.setDest = function(dest) {
            return this.dest = dest.toLowerCase();
        };

        CulPacket.prototype.getRawType = function() {
            return this.rawType;
        };

        CulPacket.prototype.setRawType = function(rawType) {
            return this.rawType = rawType;
        };

        CulPacket.prototype.getRawPayload = function() {
            return this.rawPayload;
        };

        CulPacket.prototype.setRawPayload = function(rawPayload) {
            return this.rawPayload = rawPayload;
        };

        CulPacket.prototype.getForMe = function() {
            return this.forMe;
        };

        CulPacket.prototype.setForMe = function(forMe) {
            return this.forMe = forMe;
        };

        CulPacket.prototype.getCommand = function() {
            return this.command;
        };

        CulPacket.prototype.setCommand = function(command) {
            return this.command = command;
        };

        CulPacket.prototype.getStatus = function() {
            return this.status;
        };

        CulPacket.prototype.setStatus = function(status) {
            return this.status = status;
        };

        CulPacket.prototype.getRawPacket = function() {
            if (this.getCredits) {
                return 'X';
            } else {
                return this.rawPacket;
            }
        };

        CulPacket.prototype.setRawPacket = function(rawPacket) {
            return this.rawPacket = rawPacket;
        };

        CulPacket.prototype.getRawPayload = function() {
            return this.rawPayload;
        };

        CulPacket.prototype.setRawPayload = function(rawPayload) {
            return this.rawPayload = rawPayload.toUpperCase();
        };

        CulPacket.prototype.getSendTries = function() {
            return this.sendTries;
        };

        CulPacket.prototype.setSendTries = function(sendTries) {
            return this.sendTries = sendTries;
        };

        CulPacket.prototype.getDecodedPayload = function() {
            return this.decodedPayload;
        };

        CulPacket.prototype.setDecodedPayload = function(decodedPayload) {
            return this.decodedPayload = decodedPayload;
        };

        return CulPacket;

    })();
};