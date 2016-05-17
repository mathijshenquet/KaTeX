var utils = require("../utils");
var ParseError = require("../ParseError");

/* This file contains a list of functions that we parse, identified by
 * the calls to defineFunction.
 *
 * The first argument to defineFunction is a single name or a list of names.
 * All functions named in such a list will share a single implementation.
 *
 * (optional) Each declared function can have associated properties. If this is
 * not specified the number of arguments is inferred from the handler. The 
 * following properties are recognized:
 *
 *  - numArgs: The number of arguments the function takes.
 *  - argTypes: (optional) An array corresponding to each argument of the
 *              function, giving the type of argument that should be parsed. Its
 *              length should be equal to `numArgs + numOptionalArgs`. Valid
 *              types:
 *               - "size": A size-like thing, such as "1em" or "5ex"
 *               - "color": An html color, like "#abc" or "blue"
 *               - "original": The same type as the environment that the
 *                             function being parsed is in (e.g. used for the
 *                             bodies of functions like \color where the first
 *                             argument is special and the second argument is
 *                             parsed normally)
 *              Other possible types (probably shouldn't be used)
 *               - "text": Text-like (e.g. \text)
 *               - "math": Normal math
 *              If undefined, this will be treated as an appropriate length
 *              array of "original" strings
 *  - greediness: (optional) The greediness of the function to use ungrouped
 *                arguments.f
 *
 *                E.g. if you have an expression
 *                  \sqrt \frac 1 2
 *                since \frac has greediness=2 vs \sqrt's greediness=1, \frac
 *                will use the two arguments '1' and '2' as its two arguments,
 *                then that whole function will be used as the argument to
 *                \sqrt. On the other hand, the expressions
 *                  \frac \frac 1 2 3
 *                and
 *                  \frac \sqrt 1 2
 *                will fail because \frac and \frac have equal greediness
 *                and \sqrt has a lower greediness than \frac respectively. To
 *                make these parse, we would have to change them to:
 *                  \frac {\frac 1 2} 3
 *                and
 *                  \frac {\sqrt 1} 2
 *
 *                The default value is `1`
 *  - allowedInText: (optional) Whether or not the function is allowed inside
 *                   text mode (default false)
 *  - numOptionalArgs: (optional) The number of optional arguments the function
 *                     should parse. If the optional arguments aren't found,
 *                     `null` will be passed to the handler in their place.
 *                     (default 0)
 *
 * The last argument is that implementation, the handler for the function(s).
 * It is called to handle these functions and their arguments.
 * It receives two arguments:
 *  - context contains information and references provided by the parser
 *  - args is an array of arguments obtained from TeX input
 * The context contains the following properties:
 *  - funcName: the text (i.e. name) of the function, including \
 *  - parser: the parser object
 *  - lexer: the lexer object
 *  - positions: the positions in the overall string of the function
 *               and the arguments.
 * The latter three should only be used to produce error messages.
 *
 * The function should return an object with the following keys:
 *  - type: The type of element that this is. This is then used in
 *          buildHTML/buildMathML to determine which function
 *          should be called to build this node into a DOM node
 * Any other data can be added to the object, which will be passed
 * in to the function in buildHTML/buildMathML as `group.value`.
 */

var call = function(context, args) {
    // The context is augmented such that from within a funciton
    // we can call other functions 
    context.call = function(name, args){
        var innerContext = {
            funcName: name,
            lexer: this.lexer,
            parser: this.parser,
            symbol: this.symbol
        }

        return call(innerContext, args);
    }

    var func;
    if(func = exports[context.funcName])
        return func.handler.apply(context, args);

    if(args === undefined){
        context.parser.parseSymbol(context.funcName);
    }
}

exports.__call = call;

function defineFunction(names, props, handler) {
    if(handler === undefined){
        handler = props;
        props = { numArgs: handler.length };
    }

    if (typeof names === "string") {
        names = [names];
    }

    // Set default values of functions
    var data = {
        numArgs: props.numArgs,
        argTypes: props.argTypes,
        greediness: (props.greediness === undefined) ? 1 : props.greediness,
        allowedInText: !!props.allowedInText,
        numOptionalArgs: props.numOptionalArgs || 0,
        handler: handler
    };
    for (var i = 0; i < names.length; ++i) {
        exports[names[i]] = data;
    }
}

// A normal square root
defineFunction("\\sqrt", {
    numArgs: 1,
    numOptionalArgs: 1,
}, function(index, body) {
    return {
        type: "sqrt",
        body: body,
        index: index,
    };
});

// Some non-mathy text
defineFunction("\\text", {
    numArgs: 1,
    argTypes: ["text"],
    greediness: 2,
}, function(body) {
    return {
        type: "text",
        body: body,
    };
});

// A two-argument custom color
defineFunction("\\color", {
    numArgs: 2,
    allowedInText: true,
    greediness: 3,
    argTypes: ["color", "original"],
}, function(color, body) {
    return {
        type: "color",
        color: color,
        value: body,
    };
});

// An overline
defineFunction("\\overline", function(body) {
    return {
        type: "overline",
        body: body,
    };
});

// An underline
defineFunction("\\underline", function(body) {
    return {
        type: "underline",
        body: body,
    };
});

// A box of the width and height
defineFunction("\\rule", {
    numArgs: 2,
    numOptionalArgs: 1,
    argTypes: ["size", "size", "size"],
}, function(shift, width, height) {
    return {
        type: "rule",
        shift: shift && shift.value,
        width: width,
        height: height,
    };
});

defineFunction("\\kern", {
    numArgs: 1,
    argTypes: ["size"],
}, function(dimension) {
    return {
        type: "kern",
        dimension: dimension,
    };
});

// A KaTeX logo
defineFunction("\\KaTeX", function() {
    return {
        type: "katex",
    };
});

defineFunction("\\phantom", function(body) {
    return {
        type: "phantom",
        value: body,
    };
});

// Extra data needed for the delimiter handler down below
var delimiterSizes = {
    "\\bigl" : {type: "open",    size: 1},
    "\\Bigl" : {type: "open",    size: 2},
    "\\biggl": {type: "open",    size: 3},
    "\\Biggl": {type: "open",    size: 4},
    "\\bigr" : {type: "close",   size: 1},
    "\\Bigr" : {type: "close",   size: 2},
    "\\biggr": {type: "close",   size: 3},
    "\\Biggr": {type: "close",   size: 4},
    "\\bigm" : {type: "rel",     size: 1},
    "\\Bigm" : {type: "rel",     size: 2},
    "\\biggm": {type: "rel",     size: 3},
    "\\Biggm": {type: "rel",     size: 4},
    "\\big"  : {type: "textord", size: 1},
    "\\Big"  : {type: "textord", size: 2},
    "\\bigg" : {type: "textord", size: 3},
    "\\Bigg" : {type: "textord", size: 4},
};

var delimiters = [
    "(", ")", "[", "\\lbrack", "]", "\\rbrack",
    "\\{", "\\lbrace", "\\}", "\\rbrace",
    "\\lfloor", "\\rfloor", "\\lceil", "\\rceil",
    "<", ">", "\\langle", "\\rangle", "\\lt", "\\gt",
    "\\lvert", "\\rvert", "\\lVert", "\\rVert",
    "\\lgroup", "\\rgroup", "\\lmoustache", "\\rmoustache",
    "/", "\\backslash",
    "|", "\\vert", "\\|", "\\Vert",
    "\\uparrow", "\\Uparrow",
    "\\downarrow", "\\Downarrow",
    "\\updownarrow", "\\Updownarrow",
    ".",
];

var fontAliases = {
    "\\Bbb": "\\mathbb",
    "\\bold": "\\mathbf",
    "\\frak": "\\mathfrak",
};

// Single-argument color functions
defineFunction([
    "\\blue", "\\orange", "\\pink", "\\red",
    "\\green", "\\gray", "\\purple",
    "\\blueA", "\\blueB", "\\blueC", "\\blueD", "\\blueE",
    "\\tealA", "\\tealB", "\\tealC", "\\tealD", "\\tealE",
    "\\greenA", "\\greenB", "\\greenC", "\\greenD", "\\greenE",
    "\\goldA", "\\goldB", "\\goldC", "\\goldD", "\\goldE",
    "\\redA", "\\redB", "\\redC", "\\redD", "\\redE",
    "\\maroonA", "\\maroonB", "\\maroonC", "\\maroonD", "\\maroonE",
    "\\purpleA", "\\purpleB", "\\purpleC", "\\purpleD", "\\purpleE",
    "\\mintA", "\\mintB", "\\mintC",
    "\\grayA", "\\grayB", "\\grayC", "\\grayD", "\\grayE",
    "\\grayF", "\\grayG", "\\grayH", "\\grayI",
    "\\kaBlue", "\\kaGreen",
], {
    numArgs: 1,
    allowedInText: true,
    greediness: 3,
}, function(body) {
    return {
        type: "color",
        color: "katex-" + this.funcName.slice(1),
        value: body,
    };
});

// There are 2 flags for operators; whether they produce limits in
// displaystyle, and whether they are symbols and should grow in
// displaystyle. These four groups cover the four possible choices.

// No limits, not symbols
defineFunction([
    "\\arcsin", "\\arccos", "\\arctan", "\\arg", "\\cos", "\\cosh",
    "\\cot", "\\coth", "\\csc", "\\deg", "\\dim", "\\exp", "\\hom",
    "\\ker", "\\lg", "\\ln", "\\log", "\\sec", "\\sin", "\\sinh",
    "\\tan", "\\tanh",
], function() {
    return {
        type: "op",
        limits: false,
        symbol: false,
        body: this.funcName,
    };
});

// Limits, not symbols
defineFunction([
    "\\det", "\\gcd", "\\inf", "\\lim", "\\liminf", "\\limsup", "\\max",
    "\\min", "\\Pr", "\\sup",
], function() {
    return {
        type: "op",
        limits: true,
        symbol: false,
        body: this.funcName,
    };
});

// No limits, symbols
defineFunction([
    "\\int", "\\iint", "\\iiint", "\\oint",
], function() {
    return {
        type: "op",
        limits: false,
        symbol: true,
        body: this.funcName,
    };
});

// Limits, symbols
defineFunction([
    "\\coprod", "\\bigvee", "\\bigwedge", "\\biguplus", "\\bigcap",
    "\\bigcup", "\\intop", "\\prod", "\\sum", "\\bigotimes",
    "\\bigoplus", "\\bigodot", "\\bigsqcup", "\\smallint",
], function() {
    return {
        type: "op",
        limits: true,
        symbol: true,
        body: this.funcName,
    };
});

// Fractions
defineFunction([
    "\\dfrac", "\\frac", "\\tfrac",
    "\\dbinom", "\\binom", "\\tbinom",
], {
    numArgs: 2,
    greediness: 2,
}, function(numer, denom) {
    var hasBarLine;
    var leftDelim = null;
    var rightDelim = null;
    var size = "auto";

    switch (this.funcName) {
        case "\\dfrac":
        case "\\frac":
        case "\\tfrac":
            hasBarLine = true;
            break;
        case "\\dbinom":
        case "\\binom":
        case "\\tbinom":
            hasBarLine = false;
            leftDelim = "(";
            rightDelim = ")";
            break;
        default:
            throw new Error("Unrecognized genfrac command");
    }

    switch (this.funcName) {
        case "\\dfrac":
        case "\\dbinom":
            size = "display";
            break;
        case "\\tfrac":
        case "\\tbinom":
            size = "text";
            break;
    }

    return {
        type: "genfrac",
        numer: numer,
        denom: denom,
        hasBarLine: hasBarLine,
        leftDelim: leftDelim,
        rightDelim: rightDelim,
        size: size,
    };
});

// Left and right overlap functions
defineFunction(["\\llap", "\\rlap"], {
    numArgs: 1,
    allowedInText: true,
}, function(body) {
    return {
        type: this.funcName.slice(1),
        body: body,
    };
});

// Delimiter functions
defineFunction([
    "\\bigl", "\\Bigl", "\\biggl", "\\Biggl",
    "\\bigr", "\\Bigr", "\\biggr", "\\Biggr",
    "\\bigm", "\\Bigm", "\\biggm", "\\Biggm",
    "\\big",  "\\Big",  "\\bigg",  "\\Bigg",
    "\\left", "\\right",
], function(delim) {
    if (!utils.contains(delimiters, delim.value)) {
        throw new ParseError(
            "Invalid delimiter: '" + delim.value + "' after '" +
                this.funcName + "'",
            this.lexer, this.positions[1]);
    }

    // \left and \right are caught somewhere in Parser.js, which is
    // why this data doesn't match what is in buildHTML.
    if (this.funcName === "\\left" || this.funcName === "\\right") {
        return {
            type: "leftright",
            value: delim.value,
        };
    } else {
        return {
            type: "delimsizing",
            size: delimiterSizes[this.funcName].size,
            delimType: delimiterSizes[this.funcName].type,
            value: delim.value,
        };
    }
});

// Sizing functions (handled in Parser.js explicitly, hence no handler)
defineFunction([
    "\\tiny", "\\scriptsize", "\\footnotesize", "\\small",
    "\\normalsize", "\\large", "\\Large", "\\LARGE", "\\huge", "\\Huge",
], {numArgs: 0}, null);

// Style changing functions (handled in Parser.js explicitly, hence no
// handler)
defineFunction([
    "\\displaystyle", "\\textstyle", "\\scriptstyle",
    "\\scriptscriptstyle",
], {numArgs: 0}, null);

defineFunction([
    // styles
    "\\mathrm", "\\mathit", "\\mathbf",

    // families
    "\\mathbb", "\\mathcal", "\\mathfrak", "\\mathscr", "\\mathsf",
    "\\mathtt",

    // aliases
    "\\Bbb", "\\bold", "\\frak",
], {
    numArgs: 1,
    greediness: 2,
}, function(body) {
    var func = this.funcName;
    if (func in fontAliases) {
        func = fontAliases[func];
    }
    return {
        type: "font",
        font: func.slice(1),
        body: body,
    };
});

// Accents
defineFunction([
    "\\acute", "\\grave", "\\ddot", "\\tilde", "\\bar", "\\breve",
    "\\check", "\\hat", "\\vec", "\\dot", 
    "\\widehat", "\\widetilde", "\\widebar", "\\widecheck"
    // We don't support expanding accents yet
    // "\\widetilde", "\\widehat"
], function(base) {
    return {
        type: "accent",
        accent: this.funcName,
        base: base,
    };
});

// Infix generalized fractions
defineFunction(["\\over", "\\choose"], 2, function() {
    var replaceWith;
    switch (this.funcName) {
        case "\\over":
            replaceWith = "\\frac";
            break;
        case "\\choose":
            replaceWith = "\\binom";
            break;
        default:
            throw new Error("Unrecognized infix genfrac command");
    }
    return {
        type: "infix",
        replaceWith: replaceWith,
    };
});

// Row breaks for aligned data
defineFunction(["\\\\", "\\cr"], {
    numArgs: 0,
    numOptionalArgs: 1,
    argTypes: ["size"],
}, function(size) {
    return {
        type: "cr",
        size: size,
    };
});

// Environment delimiters
defineFunction(["\\begin", "\\end"], {
    numArgs: 1,
    argTypes: ["text"],
}, function(nameGroup) {
    if (!(nameGroup instanceof Array)) {
        throw new ParseError(
            "Invalid environment name",
            this.lexer, this.positions[1]);
    }
    var name = "";
    for (var i = 0; i < nameGroup.length; ++i) {
        name += nameGroup[i].value;
    }
    return {
        type: "environment",
        name: name,
        namepos: this.positions[1],
    };
});

var emkern = function(em){
    return {
        type: "kern",
        dimension: {
            unit: "em",
            number: em
        }
    }
}

defineFunction("\\qquad", function(){ return emkern(2); });
defineFunction("\\quad", function(){ return emkern(1); });
defineFunction("\\enspace", function(){ return emkern(0.5); });
defineFunction("\\;", function(){ return emkern(0.277778); });
defineFunction("\\;", function(){ return emkern(0.22222); });
defineFunction("\\,", function(){ return emkern(0.16667); });
defineFunction("\\!", function(){ return emkern(-0.16667); });

var mkern = function(mu){
    return {
        type: "kern", 
        dimension: {
            unit: "mu", 
            number: mu
        }
    };
}

var open = function(value){
    return {type: "open", value: value, mode: "math"};
}

var close = function(value){
    return {type: "close", value: value, mode: "math"};
}

var op = function(op){
    return {
        type: "op", 
        mode: "math",
        limits: false,
        symbol: false,
        body: "\\"+op
    }
}

 function mathchoice(display,text,script,scriptscript){
    return {
        type: "mathchoice",
        cases: [display, text, script, scriptscript]
    }
}

defineFunction("\\mathchoice",mathchoice);

function ifDisplay(display, other){
    return mathchoice(display, other, other, other);
}

// amsmath - 
// \newcommand{\pod}[1]{\allowbreak
//   \if@display\mkern18mu\else\mkern8mu\fi(#1)}
defineFunction("\\pod", function(v){
    return [ifDisplay(mkern(18), mkern(8)), open("("), v, close(")")];
})

// amsmath
// \renewcommand{\pmod}[1]{\pod{{\operator@font mod}\mkern6mu#1}}
defineFunction("\\pmod", function(v){
    return this.call("\\pod", [[op("mod"), mkern(6), v]]);
})

// amsmath
// \newcommand{\implies}{\DOTSB\;\Longrightarrow\;}
defineFunction("\\implies", function(){
    return [this.call("\\;"), this.symbol("math", "\\Longrightarrow"), this.call("\\;")];
})
