import hljs from "highlight.js/lib/core";
import type { LanguageFn } from "highlight.js";
import xml from "highlight.js/lib/languages/xml";
import bashBase from "highlight.js/lib/languages/bash";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import css from "highlight.js/lib/languages/css";
import markdown from "highlight.js/lib/languages/markdown";
import diff from "highlight.js/lib/languages/diff";
import ruby from "highlight.js/lib/languages/ruby";
import go from "highlight.js/lib/languages/go";
import graphql from "highlight.js/lib/languages/graphql";
import ini from "highlight.js/lib/languages/ini";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import json from "highlight.js/lib/languages/json";
import kotlin from "highlight.js/lib/languages/kotlin";
import less from "highlight.js/lib/languages/less";
import lua from "highlight.js/lib/languages/lua";
import makefile from "highlight.js/lib/languages/makefile";
import perl from "highlight.js/lib/languages/perl";
import objectivec from "highlight.js/lib/languages/objectivec";
import php from "highlight.js/lib/languages/php";
import phpTemplate from "highlight.js/lib/languages/php-template";
import plaintext from "highlight.js/lib/languages/plaintext";
import python from "highlight.js/lib/languages/python";
import pythonRepl from "highlight.js/lib/languages/python-repl";
import r from "highlight.js/lib/languages/r";
import rust from "highlight.js/lib/languages/rust";
import scss from "highlight.js/lib/languages/scss";
import shell from "highlight.js/lib/languages/shell";
import sql from "highlight.js/lib/languages/sql";
import swift from "highlight.js/lib/languages/swift";
import yaml from "highlight.js/lib/languages/yaml";
import typescript from "highlight.js/lib/languages/typescript";
import vbnet from "highlight.js/lib/languages/vbnet";
import wasm from "highlight.js/lib/languages/wasm";
import apache from "highlight.js/lib/languages/apache";
import awk from "highlight.js/lib/languages/awk";
import clojure from "highlight.js/lib/languages/clojure";
import cmake from "highlight.js/lib/languages/cmake";
import dart from "highlight.js/lib/languages/dart";
import dns from "highlight.js/lib/languages/dns";
import dockerfile from "highlight.js/lib/languages/dockerfile";
import dos from "highlight.js/lib/languages/dos";
import elixir from "highlight.js/lib/languages/elixir";
import erlang from "highlight.js/lib/languages/erlang";
import gradle from "highlight.js/lib/languages/gradle";
import groovy from "highlight.js/lib/languages/groovy";
import haskell from "highlight.js/lib/languages/haskell";
import http from "highlight.js/lib/languages/http";
import julia from "highlight.js/lib/languages/julia";
import latex from "highlight.js/lib/languages/latex";
import lisp from "highlight.js/lib/languages/lisp";
import matlab from "highlight.js/lib/languages/matlab";
import nginx from "highlight.js/lib/languages/nginx";
import nix from "highlight.js/lib/languages/nix";
import ocaml from "highlight.js/lib/languages/ocaml";
import powershell from "highlight.js/lib/languages/powershell";
import properties from "highlight.js/lib/languages/properties";
import protobuf from "highlight.js/lib/languages/protobuf";
import scala from "highlight.js/lib/languages/scala";
import stylus from "highlight.js/lib/languages/stylus";
import verilog from "highlight.js/lib/languages/verilog";
import vim from "highlight.js/lib/languages/vim";

const EXTRA_SHELL_BUILTINS = [
  "sudo", "docker", "podman", "kubectl", "helm", "git", "curl", "wget", "ssh",
  "scp", "rsync", "systemctl", "journalctl", "nginx", "redis-server", "redis-cli",
  "mysql", "psql", "npm", "pnpm", "yarn", "npx", "node", "python", "python3",
  "pip", "pip3", "java", "javac", "mvn", "gradle", "cargo", "rustc", "go",
  "make", "cmake", "tar", "unzip", "chmod", "chown", "mkdir", "cp", "mv", "rm",
  "ls", "cat", "head", "tail", "grep", "sed", "awk", "find", "xargs", "ps", "kill",
];

export const enhancedBash: LanguageFn = (h) => {
  const grammar = bashBase(h);
  if (grammar.keywords && typeof grammar.keywords === "object" && !Array.isArray(grammar.keywords)) {
    const existing = grammar.keywords.built_in;
    if (Array.isArray(existing)) {
      grammar.keywords.built_in = [...existing, ...EXTRA_SHELL_BUILTINS];
    } else if (typeof existing === "string") {
      grammar.keywords.built_in = `${existing} ${EXTRA_SHELL_BUILTINS.join(" ")}`;
    }
  }
  if (Array.isArray(grammar.contains)) {
    grammar.contains.push(
      { className: "attr", begin: /(?:^|(?<=\s))--?[a-zA-Z][\w-]*/ },
      { className: "number", begin: /\b\d+(?:\.\d+)?(?:[kKmMgGtT][bB]?)?\b/ },
      { className: "operator", begin: /\\$/m },
    );
  }
  return grammar;
};

export const HLJS_LANGUAGES: Record<string, LanguageFn> = {
  xml,
  bash: enhancedBash,
  c,
  cpp,
  csharp,
  css,
  markdown,
  diff,
  ruby,
  go,
  graphql,
  ini,
  java,
  javascript,
  json,
  kotlin,
  less,
  lua,
  makefile,
  perl,
  objectivec,
  php,
  "php-template": phpTemplate,
  plaintext,
  python,
  "python-repl": pythonRepl,
  r,
  rust,
  scss,
  shell,
  sql,
  swift,
  yaml,
  typescript,
  vbnet,
  wasm,
  apache,
  awk,
  clojure,
  cmake,
  dart,
  dns,
  dockerfile,
  dos,
  elixir,
  erlang,
  gradle,
  groovy,
  haskell,
  http,
  julia,
  latex,
  lisp,
  matlab,
  nginx,
  nix,
  ocaml,
  powershell,
  properties,
  protobuf,
  scala,
  stylus,
  verilog,
  vim,
};

export const HLJS_ALIASES: Record<string, string[]> = {
  bash: ["sh", "shell", "zsh"],
  dockerfile: ["docker"],
  powershell: ["ps", "ps1", "pwsh"],
  dos: ["bat", "cmd"],
  properties: ["env", "dotenv", "conf"],
  nginx: ["nginxconf"],
  protobuf: ["proto"],
  latex: ["tex"],
  ini: ["toml"],
  xml: ["vue", "svelte"],
  typescript: ["tsx"],
  javascript: ["jsx"],
};

for (const [lang, mod] of Object.entries(HLJS_LANGUAGES)) {
  hljs.registerLanguage(lang, mod);
}

for (const [lang, aliases] of Object.entries(HLJS_ALIASES)) {
  hljs.registerAliases(aliases, { languageName: lang });
}

export { hljs };
