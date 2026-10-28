{ config, ... }:

let
  host = config.modules.host;
in
{
  modules = {
    home-manager = {
      programs = {
        fzf = {
          enable = true;

          defaultOptions = [
            "--walker=file,follow,hidden"
            "--walker-root=."
            "--walker-skip=${builtins.concatStringsSep "," host.ignores}"
            "--height=40%"
            "--layout=reverse"
            "--info=inline"
            "--border=rounded"
            "--ansi"
            "--highlight-line"
            "--gutter ' '"
            "--color=selected-bg:238,selected-fg:146,current-fg:189"
          ];
        };
      };
    };
  };
}
