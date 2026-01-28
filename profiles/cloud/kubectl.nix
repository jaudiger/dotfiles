{ config, pkgs, ... }:

let
  host = config.modules.host;
in
{
  sops = {
    # To decrypt the secret: "nix-shell -p sops --run 'sops -d secrets/kube/config'"
    # To encrypt the secret: "nix-shell -p sops --run 'sops -e secrets/kube/config' > secrets/kube/config"
    secrets.kube_config = {
      sopsFile = ../../secrets/kube/config;
      format = "binary";

      path = "${host.homeDirectory}/.kube/config";
      owner = host.username;
      mode = "0400";
    };
  };

  modules = {
    home-manager = {
      home = {
        packages = with pkgs; [
          kubectl

          kubent
          stern
          popeye
        ];
      };

      programs = {
        # Enable bash auto-completion (+ the alias)
        bash = {
          initExtra = ''
            source <(kubectl completion bash)
            complete -o default -F __start_kubectl k
          '';
        };

        # Enable zsh auto-completion (+ the alias)
        zsh = {
          initContent = ''
            source <(kubectl completion zsh)
            compdef __start_kubectl k
          '';
        };
      };
    };

    host.shell.aliases = {
      k = "kubectl";
    };
  };
}
