{ pkgs, ... }:

{
  modules = {
    home-manager = {
      programs = {
        fzf = {
          enable = true;

          defaultOptions = [
            "--walker=file,follow,hidden"
            "--walker-root=."
            "--walker-skip=.angular,.cache,.devenv,.git,.gradle,.idea,.jj,.next,.pnpm-store,.swc,.venv,.zig-cache,build,coverage,dist,node_modules,output,target,zig-out,__pycache__"
            "--height=40%"
            "--layout=reverse"
            "--info=inline"
            "--border=rounded"
            "--ansi"
            "--marker=▏"
            "--pointer=▌"
            "--prompt '▌ '"
            "--highlight-line"
            "--color=gutter:-1,selected-bg:238,selected-fg:146,current-fg:189"
          ];
        };
      };

      home.packages = with pkgs; [ tree ];
    };

    host.shell.nonPortableAliases = {
      tree-explorer = ''
        find . -type d | fzf --multi --height=80% --border=sharp \
          --preview='tree -C {}' --preview-window='45%,border-sharp' \
          --prompt='Dirs > ' \
          --bind='enter:execute($VISUAL {+})' \
          --bind='del:execute(rm -ri {+})' \
          --bind='ctrl-d:change-prompt(Dirs > )' \
          --bind='ctrl-d:+reload(find . -type d)' \
          --bind='ctrl-d:+change-preview(tree -C {})' \
          --bind='ctrl-d:+refresh-preview' \
          --bind='ctrl-f:change-prompt(Files > )' \
          --bind='ctrl-f:+reload(find . -type f)' \
          --bind='ctrl-f:+change-preview(cat {})' \
          --bind='ctrl-f:+refresh-preview' \
          --bind='ctrl-a:select-all' \
          --bind='ctrl-x:deselect-all' \
          --header '
          CTRL-D to display directories | CTRL-F to display files
          CTRL-A to select all | CTRL-x to deselect all
          ENTER to edit | DEL to delete'
      '';
    };
  };
}
