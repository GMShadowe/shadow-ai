"""Every tool Shadow has, in one place. Each entry has the function
to run and the schema the model sees. Adapters pick a subset."""

from tools import files, shell, web, desktop, meta, display


def _schema(name: str, description: str, props: dict, required: list[str]) -> dict:
    return {
        "type": "function",
        "function": {
            "name": name,
            "description": description,
            "parameters": {"type": "object", "properties": props, "required": required},
        },
    }


S = {"type": "string"}
LIST_ITEMS = {"type": "array", "items": {"type": "object", "properties": {
    "title": S, "detail": S}, "required": ["title"]}}
STRINGS = {"type": "array", "items": S}
NUMBERS = {"type": "array", "items": {"type": "number"}}


def _tool(fn, schema, danger="safe", preview=None):
    return {"fn": fn, "schema": schema, "danger": danger, "preview": preview}


TOOLS = {
    "read_file": _tool(files.read_file,
        _schema("read_file", "Read a text file inside the workspace.", {"path": S}, ["path"])),
    "write_file": _tool(files.write_file,
        _schema("write_file", "Create a new file or fully overwrite one. For small changes use edit_file instead.",
                {"path": S, "content": S}, ["path", "content"]), "caution"),
    "edit_file": _tool(files.edit_file,
        _schema("edit_file", "Replace one exact piece of text in a file. 'find' must match exactly and only once.",
                {"path": S, "find": S, "replace": S}, ["path", "find", "replace"]), "caution"),
    "move_file": _tool(files.move_file,
        _schema("move_file", "Rename or move a file inside the workspace.",
                {"source": S, "dest": S}, ["source", "dest"]), "caution"),
    "delete_file": _tool(files.delete_file,
        _schema("delete_file", "Permanently delete one file inside the workspace.", {"path": S}, ["path"]), "dangerous"),
    "delete_dir": _tool(files.delete_dir,
        _schema("delete_dir", "Permanently delete a folder and everything inside it, inside the workspace.",
                {"path": S}, ["path"]), "dangerous"),
    "list_dir": _tool(files.list_dir,
        _schema("list_dir", "List files and folders in a workspace folder. Use '.' for the root.", {"path": S}, [])),
    "find_files": _tool(files.find_files,
        _schema("find_files", "Find files by name anywhere in the workspace. Supports wildcards like '*.py'.",
                {"pattern": S}, ["pattern"])),
    "search_text": _tool(files.search_text,
        _schema("search_text", "Find which files contain some text. Returns file, line number and the line.",
                {"query": S, "path": S}, ["query"])),
    "run_command": _tool(shell.run_command,
        _schema("run_command", "Run a shell command in the workspace. Returns output and exit code.",
                {"command": S}, ["command"]), "caution", preview=shell.describe),
    "kill_process": _tool(desktop.kill_process,
        _schema("kill_process", "Stop a running process by its exact name or its process id.",
                {"target": S}, ["target"]), "dangerous", preview=desktop.describe_kill),
    "open_app": _tool(desktop.open_app,
        _schema("open_app", "Open an installed application on the user's computer by its name, e.g. 'Safari'. "
                "Not for files or paths.", {"name": S}, ["name"]), "caution"),
    "system_info": _tool(desktop.system_info,
        _schema("system_info", "Get OS, CPU, RAM and disk information about this computer.", {}, [])),
    "web_search": _tool(web.web_search,
        _schema("web_search", "Search the web. Returns the top 5 results with titles, links and snippets.",
                {"query": S}, ["query"])),
    "fetch_url": _tool(web.fetch_url,
        _schema("fetch_url", "Download a web page and return its readable text (read-only GET).", {"url": S}, ["url"])),
    "http_request": _tool(web.http_request,
        _schema("http_request", "Make an HTTP request to a URL. Can POST/PUT/DELETE, so it can change things on the server.",
                {"url": S, "method": S, "body": S}, ["url"]), "dangerous"),
    "show_list": _tool(display.show_list,
        _schema("show_list", "Put a list on the user's screen. Use it when they ask for a list. Each item has a "
                "short title and a one-line detail. Only real items you know or got from a tool.",
                {"title": S, "items": LIST_ITEMS}, ["title", "items"])),
    "show_chart": _tool(display.show_chart,
        _schema("show_chart", "Put a chart on the user's screen. labels and values must be the same length. "
                "kind is 'bar' to compare things or 'line' for change over time. Only real numbers.",
                {"title": S, "labels": STRINGS, "values": NUMBERS, "unit": S, "kind": S},
                ["title", "labels", "values"])),
    "show_images": _tool(display.show_images,
        _schema("show_images", "Search the web for pictures and put them on the user's screen.",
                {"query": S, "count": {"type": "integer"}}, ["query"])),
    "about_me": _tool(meta.about_me,
        _schema("about_me", "Get full details about yourself: your model, settings, every tool and its state, memory count and limits. Use this when the user asks what you can do.", {}, [])),
}


def get_schemas(names: list[str]) -> list[dict]:
    return [TOOLS[n]["schema"] for n in names if n in TOOLS]


def preview(name: str, arguments: dict) -> str | None:
    fn = TOOLS.get(name, {}).get("preview")
    if not fn:
        return None
    try:
        return str(fn(**{k: v for k, v in (arguments or {}).items()
                         if k in TOOLS[name]["schema"]["function"]["parameters"]["properties"]}))
    except Exception as e:
        print(f"[tools] couldn't preview {name}: {e}")
        return f"Couldn't work out what this would affect: {e}"


def call_tool(name: str, arguments: dict) -> str:
    if name not in TOOLS:
        return f"Error: unknown tool '{name}'."

    arguments = arguments or {}
    params = TOOLS[name]["schema"]["function"]["parameters"]
    expected = list(params["properties"].keys())

    missing = [r for r in params.get("required", []) if r not in arguments]
    if missing:
        return (f"Error: {name} is missing {', '.join(missing)}. "
                f"Call {name} again with all of these: {', '.join(expected)}.")

    # Ignore any extra arguments the model made up.
    arguments = {k: v for k, v in arguments.items() if k in params["properties"]}

    try:
        return str(TOOLS[name]["fn"](**arguments))
    except files.PathRefused as e:
        return f"Error: {e}"
    except Exception as e:
        return (f"Internal error in Shadow's {name} tool: {e}. "
                "This is a bug in Shadow itself, not in the user's code or computer. "
                "Tell the user plainly that Shadow's tool failed.")
