{ pkgs, ... }:

{
  modules = {
    home-manager = {
      home = {
        packages = with pkgs; [
          kubernetes-helm
          helm-docs

          # TODO: Re-enable once the plugin is fixed
          # (wrapHelm kubernetes-helm {
          #   plugins = [
          #     kubernetes-helmPlugins.helm-s3
          #   ];
          # })
        ];
      };
    };
  };
}
