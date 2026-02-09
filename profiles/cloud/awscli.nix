{ config, ... }:

let
  host = config.modules.host;
in
{
  modules.home-manager = {
    programs.awscli = {
      enable = true;

      settings = {
        default = {
          csm_enabled = true;
          region = "eu-west-3";
          output = "json";
        };
      };
    };
  };

  sops = {
    # To edit the secret: "nix-shell -p sops --run 'sops secrets/aws/credentials.yaml'"
    secrets = {
      aws_access_key_id = {
        sopsFile = ../../secrets/aws/credentials.yaml;
      };
      aws_secret_access_key = {
        sopsFile = ../../secrets/aws/credentials.yaml;
      };
    };

    templates.aws_credentials = {
      path = "${host.homeDirectory}/.aws/credentials";
      owner = host.username;
      mode = "0600";
      content = ''
        [default]
        aws_access_key_id=${config.sops.placeholder.aws_access_key_id}
        aws_secret_access_key=${config.sops.placeholder.aws_secret_access_key}
      '';
    };
  };
}
