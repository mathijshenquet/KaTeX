var buildHTML = require("./html/build");
var buildMathML = require("./mathml/build");
var buildCommon = require("./common");
var Options = require("./Options");
var Style = require("../Style");

var makeSpan = buildCommon.makeSpan;

exports.buildHybrid = function(tree, expression, settings) {
    settings = settings || {};

    // `buildHTML` sometimes messes with the parse tree (like turning bins ->
    // ords), so we build the MathML version first.
    var mathMLNode = buildMathML(tree, expression, settings);
    var htmlNode = buildHTML(tree, settings);

    
    var katexNode = makeSpan(["katex"], [
        mathMLNode, htmlNode,
    ]);

    if (settings.displayStyle) {
        return makeSpan(["katex-display"], [katexNode]);
    } else {
        return katexNode;
    }
};

exports.buildHTML = buildHTML;
exports.buildMathML = buildMathML;