/**
 * The resulting parse tree nodes of the parse tree.
 */
function ParseNode(type, value, mode) {
	if(type == undefined && value instanceof Array){
		type = "ordgroup";
	}

    this.type = type;
    this.value = value;
    this.mode = mode;
}

module.exports = {
    ParseNode: ParseNode,
};

