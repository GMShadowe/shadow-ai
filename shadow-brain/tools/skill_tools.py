import skills


def add_skill(source, name=None) -> str:
    source = str(source or "").strip()
    if not source:
        return "Error: say where the skill is - a GitHub link, or owner/repo with the skill's name."
    try:
        skill = skills.add_from_link(source, str(name).strip() if name else None)
    except skills.SkillExists as e:
        return f"Error: {e} The user can already use it by typing its name with / in the composer."
    except skills.SkillError as e:
        return f"Error: {e}"
    files = f" with {skill['files']} files beside it" if skill.get("files") else ""
    return (f"Added the '{skill['name']}' skill from {skill['source']}{files}. "
            f"What it does: {skill['description']}\n"
            f"It hasn't been reviewed yet, so you can't use it. Tell the user to type /{skill['name']} "
            "in the composer: Shadow shows them every word of it first, and they approve it there.")
