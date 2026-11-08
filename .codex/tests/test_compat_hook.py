import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ADAPTER = Path(__file__).parent.parent / 'hooks/compat_hook.py'

class AdapterTests(unittest.TestCase):
    def run_hook(self, script, event, setup=None):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root/'.codex/hooks').mkdir(parents=True)
            (root/'.cursor/hooks').mkdir(parents=True)
            shutil.copy2(ADAPTER, root/'.codex/hooks/compat_hook.py')
            source=root/'.cursor/hooks/check.sh'
            source.write_text(script)
            if setup: setup(root)
            result=subprocess.run(['python3',str(root/'.codex/hooks/compat_hook.py'),'.cursor/hooks/check.sh'],input=json.dumps(dict(event,cwd=str(root))),capture_output=True,text=True)
            self.assertEqual(result.returncode,0,result.stderr)
            return json.loads(result.stdout)

    def test_cursor_ask_is_supported_denial(self):
        result=self.run_hook('echo \'{"permission":"ask","agent_message":"Review destructive operation"}\'',{'tool_name':'Bash','tool_input':{'command':'harmless fixture'}})
        self.assertEqual(result['hookSpecificOutput']['permissionDecision'],'deny')
        self.assertIn('Review destructive',result['hookSpecificOutput']['permissionDecisionReason'])

    def test_patch_checks_every_file_including_moves(self):
        script='''python3 -c 'import sys,json; d=json.load(sys.stdin); print(json.dumps({"permission":"deny" if d["file_path"].endswith("protected.sql") else "allow","agent_message":"shipped migration"}))' '''
        result=self.run_hook(script,{'tool_name':'apply_patch','tool_input':{'command':'*** Begin Patch\n*** Update File: harmless.ts\n*** Update File: protected.sql\n*** End Patch'}})
        self.assertEqual(result['hookSpecificOutput']['permissionDecision'],'deny')
        result=self.run_hook(script,{'tool_name':'apply_patch','tool_input':{'command':'*** Begin Patch\n*** Update File: harmless.ts\n*** Move to: protected.sql\n*** End Patch'}})
        self.assertEqual(result['hookSpecificOutput']['permissionDecision'],'deny')

    def test_both_shell_formats_receive_command(self):
        script='''python3 -c 'import sys,json;d=json.load(sys.stdin);assert d["command"]==d["tool_input"]["command"]=="echo fixture";print("{}")' '''
        self.assertEqual(self.run_hook(script,{'tool_name':'Bash','tool_input':{'cmd':'echo fixture'}}),{})

    def test_legacy_allow_does_not_override_approval(self):
        self.assertEqual(self.run_hook('echo \'{"permission":"allow"}\'',{'tool_name':'Bash','tool_input':{'command':'echo fixture'}}),{})

if __name__=='__main__':unittest.main()
