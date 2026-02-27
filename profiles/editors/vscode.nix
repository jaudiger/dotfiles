{
  config,
  pkgs,
  lib,
  ...
}:

let
  isDarwin = config.nixpkgs.hostPlatform.isDarwin;
  isLinux = config.nixpkgs.hostPlatform.isLinux;
in
{
  modules.host.unfreePackages = lib.optionals isLinux [ "vscode" ];

  homebrew = lib.mkIf isDarwin {
    casks = [ "visual-studio-code" ];
  };

  modules.home-manager.home.packages = lib.optionals isLinux [
    pkgs.vscode
  ];
}
