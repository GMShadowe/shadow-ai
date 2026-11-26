"""run_command blocked curl only when the command had http:// in it, so
"curl wttr.in/Ahmedabad" reached the web through the shell."""
from tools.shell import fetches_the_web, run_command


def test_a_bare_host_is_the_web():
    assert fetches_the_web("curl wttr.in/ahmedabad")
    assert fetches_the_web("wget -qo- example.com")
    assert fetches_the_web("curl https://example.com")
    assert "Blocked" in run_command("curl wttr.in/Ahmedabad")


def test_this_computer_is_not():
    assert not fetches_the_web("curl localhost:3000")
    assert not fetches_the_web("curl -s http://127.0.0.1:8000/health")
    assert not fetches_the_web("curl --version")
    assert not fetches_the_web("ls -la")
