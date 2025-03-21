/*!
 * jsPOS
 *
 * Copyright 2010, Percy Wegmann
 * Licensed under the GNU LGPLv3 license
 * http://www.opensource.org/licenses/lgpl-3.0.html
 */


var re = {
  ids: /(?:^|\s)[a-z0-9-]{8,45}(?:$|\s)/ig, // ID, CRC, UUID's
  number: /[0-9]*\.[0-9]+|[0-9]+/ig,
  space: /\s+/ig,
  unblank: /\S/,
  email: /[-!#$%&'*+\/0-9=?A-Z^_a-z{|}~](?:\.?[-!#$%&'*+\/0-9=?A-Z^_a-z`{|}~])*@[a-zA-Z0-9](?:-?\.?[a-zA-Z0-9])*(?:\.[a-zA-Z](?:-?[a-zA-Z0-9])*)+/gi,
  urls: /(?:https?:\/\/)(?:[\da-z\.-]+)\.(?:[a-z\.]{2,6})(?:[\/\w\.\-\?#=]*)*\/?/ig,
  punctuation: /[\/\.\,\?\!\"\'\:\;\$\(\)\#]/ig,
  time: /(?:[0-9]|0[0-9]|1[0-9]|2[0-3]):(?:[0-5][0-9])\s?(?:[aApP][mM])/ig
}

function LexerNode(string, regex, regexs){
  string = string.trim();
  this.string = string;
  this.children = [];

  if (string) {
    this.matches = string.match(regex);
    var childElements = string.split(regex);
  }

  if (!this.matches) {
    this.matches = [];
    var childElements = [string];
  }

  if (!regexs.length) {
    // no more regular expressions, we're done
    this.children = childElements;
  } else {
    // descend recursively
    var nextRegex = regexs[0], nextRegexes = regexs.slice(1);

    for (var i in childElements) {
      if (childElements.hasOwnProperty(i)) {
        this.children.push(
          new LexerNode(childElements[i], nextRegex, nextRegexes));
      }
    }
  }
}

LexerNode.prototype.fillArray = function(array){
  for (var i in this.children) {
    if (this.children.hasOwnProperty(i)) {
      var child = this.children[i];

      if (child.fillArray) {
        child.fillArray(array);
      } else if (re.unblank.test(child)) {
        array.push(child.trim());
      }

      if (i < this.matches.length) {
        var match = this.matches[i];
        if (re.unblank.test(match))
          array.push(match.trim());
      }
    }
  }
}

LexerNode.prototype.toString = function(){
  var array = [];
  this.fillArray(array);
  return array.toString();
}

export function Lexer(){
  // URLS can contain IDS, so first urls, then ids
  // then split by then numbers, then whitespace, then email and finally punctuation
  // this.regexs = [re.urls, re.ids, re.number, re.space, re.email, re.punctuation];
  this.regexs = [
    re.urls, re.ids, re.time, re.number, re.space, re.email, re.punctuation
  ];
}

Lexer.prototype.lex = function(string){
  var array = []
    , node = new LexerNode(string, this.regexs[0], this.regexs.slice(1));

  node.fillArray(array);
  return array;
}

//var lexer = new Lexer();
//print(lexer.lex("I made $5.60 today in 1 hour of work.  The E.M.T.'s were on time, but only barely.").toString());


