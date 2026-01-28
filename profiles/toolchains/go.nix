{ config, pkgs, ... }:

let
  host = config.modules.host;

  # Shared LSP configuration for gopls
  goplsConfig = {
    analyses = {
      shadow = true;
      unusedparams = true;
      unusedwrite = true;
    };
    codelenses = {
      generate = true;
      gc_details = true;
      regenerate_cgo = true;
      tidy = true;
      upgrade_dependency = true;
      vendor = true;
    };
    hints = {
      assignVariableTypes = true;
      compositeLiteralFields = true;
      compositeLiteralTypes = true;
      constantValues = true;
      functionTypeParameters = true;
      parameterNames = true;
      rangeVariableTypes = true;
    };
    staticcheck = true;
  };
in
{
  # Per GitLab documentation, this is required in order to clone private repositories using Go tools:
  # https://docs.gitlab.com/user/project/use_project_as_go_package/?#authenticate-go-requests-to-private-projects
  sops = {
    # To decrypt the secret: "nix-shell -p sops --run 'sops -d secrets/.netrc'"
    # To encrypt the secret: "nix-shell -p sops --run 'sops -e secrets/.netrc' > secrets/.netrc"
    secrets.netrc = {
      sopsFile = ../../secrets/.netrc;
      format = "binary";

      path = "${host.homeDirectory}/.netrc";
      owner = host.username;
      mode = "0400";
    };
  };

  modules.home-manager = {
    programs.go = {
      enable = true;
    };

    home = {
      packages = with pkgs; [
        delve
        gopls

        (pkgs.lib.setPrio 10 gotools) # Lower priority to prevent collision with the `ruby` package.
        golangci-lint
        gosec
      ];
    };

    # Neovim configuration
    programs.nixvim = {
      plugins.lsp.servers = {
        gopls = {
          enable = true;
          settings = {
            gopls = goplsConfig;
          };
        };
      };
    };

    # Zed configuration
    programs.zed-editor.userSettings = {
      lsp = {
        gopls = {
          initialization_options = goplsConfig;
        };
      };
    };
  };
}
