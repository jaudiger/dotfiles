{ pkgs, ... }:

{
  modules.home-manager = {
    home.packages = with pkgs; [
      shellcheck
      shfmt

      # Language server
      bash-language-server
    ];

    programs = {
      # Claude Code configuration
      claude-code = {
        lspServers = {
          bash-language-server = {
            command = "bash-language-server";
            args = [ "start" ];
            extensionToLanguage = {
              ".sh" = "bash";
              ".bash" = "bash";
            };
          };
        };
      };

      # Neovim configuration
      nixvim = {
        plugins.lsp.servers = {
          bashls = {
            enable = true;
          };
        };
      };

      # Opencode configuration
      opencode = {
        settings = {
          lsp = {
            bash = {
              command = [
                "bash-language-server"
                "start"
              ];
            };
          };
        };
      };
    };
  };
}
