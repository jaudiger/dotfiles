{ pkgs, ... }:

let
  # Shared LSP configuration for yaml-language-server
  yamlConfig = {
    yaml = {
      completion = true;
      format = {
        enable = true;
      };
      hover = true;
      schemaStore = {
        enable = true;
      };
      schemas = {
        kubernetes = "**/*.yaml";
      };
      validate = true;
    };
  };
in
{
  modules = {
    home-manager = {
      home = {
        packages = with pkgs; [
          yaml-language-server

          # GitHub Actions workflow linter
          actionlint
        ];
      };

      # Neovim configuration
      programs.nixvim = {
        plugins.lsp.servers = {
          yamlls = {
            enable = true;
            settings = yamlConfig;
          };
        };
      };

      # Zed configuration
      programs.zed-editor.userSettings = {
        lsp = {
          "yaml-language-server" = {
            settings = yamlConfig;
          };
        };
      };

      # Claude Code configuration
      programs.claude-code.lspServers = {
        yaml-language-server = {
          command = "yaml-language-server";
          args = [ "--stdio" ];
          extensionToLanguage = {
            ".yaml" = "yaml";
            ".yml" = "yaml";
          };
        };
      };
    };
  };
}
