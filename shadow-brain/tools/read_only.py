"""Commands that only look, so run_command can run them without asking.

Strict on purpose: anything this can't prove is read-only falls back to
asking. Each piece of a pipe must be one of PLAIN, or one of SUBCOMMANDS used
only its reading way. Arguments may not leave the workspace.
"""

import glob
import os
import re
import shlex

from config import get_workspace

PLAIN = {
    "ls", "cat", "head", "wc", "du", "df", "stat", "file", "which", "whereis", "pwd", "whoami",
    "uname", "uptime", "sw_vers", "vm_stat", "nproc", "id", "groups", "printenv", "ps", "lsof",
    "netstat", "grep", "egrep", "fgrep", "tree", "cut", "tr", "nl", "md5", "shasum", "sha256sum",
    "md5sum", "cksum", "realpath", "basename", "dirname", "readlink", "mdls", "free", "cal", "tail",
    "find", "sort", "date", "hostname", "ifconfig", "od", "strings", "column", "sysctl",
}
INTERPRETERS = {"python", "python3", "node", "npm", "pip", "pip3", "ruby", "go", "cargo", "rustc",
                "java", "gcc", "clang", "make", "git", "brew", "deno", "bun", "php", "perl"}
VERSION_FLAGS = {"--version", "-v", "-V", "version"}

# A shell would act on any of these before the command ever ran: chaining,
# redirection, substitution, brace expansion (which bypasses the path check),
# and home expansion.
SHELL_SYNTAX = re.compile(r"[;&<>`$\n\r\\{}~()]")

REFUSED_FLAGS = {
    "find": re.compile(r"^-(delete|exec|execdir|ok|okdir|fprint0?|fprintf|fls|L|follow)$"),
    "sort": re.compile(r"^(-o.*|--output.*|--compress.*|-[a-z]*o.*)$"),
    "tail": re.compile(r"^(-[a-z]*[fF].*|--follow.*|--retry)$"),
    "grep": re.compile(r"^(-[a-zA-Z]*R.*|--dereference-recursive)$"),
    "egrep": re.compile(r"^(-[a-zA-Z]*R.*|--dereference-recursive)$"),
    "fgrep": re.compile(r"^(-[a-zA-Z]*R.*|--dereference-recursive)$"),
    "du": re.compile(r"^-[a-zA-Z]*L.*$"),
    "tree": re.compile(r"^(-[a-zA-Z]*[oRH].*|--fromfile.*)$"),
    "file": re.compile(r"^(-[a-zA-Z]*C.*|--compile)$"),
    "sysctl": re.compile(r"^(-[a-zA-Z]*w.*|.*=.*)$"),
}


def _no_args(args):
    return not args


def _date(args):
    return all(a.startswith("+") or a in {"-u", "-R"} for a in args)


def _hostname(args):
    return all(a in {"-s", "-f", "-i"} for a in args)


def _ifconfig(args):
    return all(re.fullmatch(r"-a|-l|-u|[a-z]+\d+", a) for a in args) and len(args) <= 2


def _ipconfig(args):
    return bool(args) and args[0] in {"getifaddr", "getpacket", "getoption", "ifcount"} and len(args) <= 2


def _pmset(args):
    return bool(args) and args[0] == "-g"


def _diskutil(args):
    return bool(args) and args[0] in {"list", "info"}


def _tar(args):
    return bool(args) and re.fullmatch(r"-?t[vzjJf]*", args[0]) is not None


def _unzip(args):
    return bool(args) and args[0] in {"-l", "-Z", "-v", "-Z1"}


def _uniq(args):
    return len([a for a in args if not a.startswith("-")]) <= 1


def _top(args):
    return "-l" in args


SUBCOMMANDS = {
    "date": _date, "hostname": _hostname, "ifconfig": _ifconfig, "ipconfig": _ipconfig,
    "pmset": _pmset, "diskutil": _diskutil, "tar": _tar, "unzip": _unzip, "top": _top, "uniq": _uniq,
    "system_profiler": lambda args: all(a.startswith("SP") or a == "-detailLevel" or a in {"mini", "basic"}
                                        for a in args),
}


CD_WORKSPACE = re.compile(r"""^cd\s+('[^']*'|"[^"]*"|[^\s'"]+)\s*&&\s*(.+)$""", re.S)


def _without_cd_to_workspace(command: str) -> str:
    """Commands already run in the workspace, so "cd <workspace> && ls" is "ls"."""
    match = CD_WORKSPACE.match(command)
    if match and os.path.realpath(match.group(1).strip("'\"")) == os.path.realpath(get_workspace()):
        return match.group(2).strip()
    return command


def is_read_only(command: str) -> bool:
    command = _without_cd_to_workspace(str(command or "").strip())
    if not command or SHELL_SYNTAX.search(command):
        return False
    pieces = command.split("|")
    if any(not p.strip() for p in pieces):
        return False
    try:
        return all(_piece_ok(shlex.split(p)) for p in pieces)
    except ValueError:
        return False


def _piece_ok(words: list[str]) -> bool:
    if not words:
        return False
    name, args = words[0], words[1:]
    if "/" in name:
        return False
    if name in INTERPRETERS:
        return len(args) == 1 and args[0] in VERSION_FLAGS
    refused = REFUSED_FLAGS.get(name)
    if refused and any(refused.match(a) for a in args):
        return False
    if name in SUBCOMMANDS:
        if not SUBCOMMANDS[name](args):
            return False
    elif name not in PLAIN:
        return False
    # A flag can carry a path ("--file=/etc/passwd", "-f/etc/passwd").
    if any(a.startswith("-") and "/" in a for a in args):
        return False
    return all(_stays_inside(a) for a in args if not a.startswith("-"))


def _stays_inside(arg: str) -> bool:
    if ".." in arg.split("/") or re.search(r"(^|/)\.[*?\[]", arg):
        return False
    workspace = os.path.realpath(get_workspace())
    if arg.startswith("/") and not _under(os.path.normpath(arg), workspace):
        return False
    matches = glob.glob(os.path.join(workspace, arg)) if re.search(r"[*?\[]", arg) else [os.path.join(workspace, arg)]
    for path in matches:
        if os.path.lexists(path) and not _under(os.path.realpath(path), workspace):
            return False
    return True


def _under(path: str, folder: str) -> bool:
    return path == folder or path.startswith(folder + os.sep)
