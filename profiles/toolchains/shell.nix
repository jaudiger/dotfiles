{ pkgs, ... }:

{
  modules.home-manager = {
    home.packages = with pkgs; [
      shellcheck
      shfmt

      # Language server
      bash-language-server
    ];

    # Neovim configuration
    programs.nixvim = {
      plugins.lsp.servers = {
        bashls = {
          enable = true;
        };
      };
    };

    # Claude Code configuration
    programs.claude-code.lspServers = {
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
}
