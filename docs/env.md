- symlink

```shell
# PowerShell Admin
New-Item -ItemType SymbolicLink `
  -Path "D:\vaults\my-vault\.obsidian\plugins\my-plugin" `
  -Target "D:\code\my-plugin-src"

# Cmd
# mklink /D "D:\vaults\my-vault\.obsidian\plugins\my-plugin" "D:\code\my-plugin-src"
mklink /J "vault-demo\.obsidian\plugins\obsidian-sample" "obsidian-sample-plugin"

# Bash
ln -s ./obsidian-sample-plugin ./vault-demo/.obsidian/plugins/obsidian-sample
```

- build copy
