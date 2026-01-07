{
  config,
  lib,
  ...
}:

let
  isDarwin = config.nixpkgs.hostPlatform.isDarwin;
in
{
  homebrew.casks = lib.mkIf isDarwin [ "claude" ];
}
