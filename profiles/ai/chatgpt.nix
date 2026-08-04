{
  config,
  lib,
  ...
}:

let
  isDarwin = config.nixpkgs.hostPlatform.isDarwin;
in
{
  homebrew = lib.mkIf isDarwin {
    casks = [ "chatgpt" ];
  };

  nixpkgs.config.allowUnfreePackages = [ "codex" ];
}
