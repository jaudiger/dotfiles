{ config, ... }:

let
  host = config.modules.host;
in
{
  nixpkgs.config.allowUnfreePackages = [
    "mistral-vibe"

    # Dependencies of 'mistral-vibe'
    "textual-speedups"
  ];

  modules.home-manager.programs.mistral-vibe = {
    enable = true;

    settings = {
      disable_welcome_banner_animation = true;

      enable_auto_update = false;
      enable_telemetry = false;
      enable_update_checks = false;

      include_commit_signature = false;

      skill_paths = [ "${host.dotfilesDirectory}/config/agents/skills" ];

      vim_keybindings = true;
    };
  };
}
