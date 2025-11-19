{ ... }:

{
  modules.home-manager = {
    programs.mcp = {
      enable = true;

      # MCP servers have to be used through supported clients. For a comprehensive list of clients, see https://github.com/modelcontextprotocol/modelcontextprotocol/blob/main/docs/clients.mdx
      servers = {
        context7 = {
          command = "npx";
          args = [
            "-y"
            "@upstash/context7-mcp"
          ];
        };
        github = {
          url = "https://api.githubcopilot.com/mcp/";
          headers = {
            Authorization = "Bearer $GITHUB_MCP_PAT";
          };
        };
      };
    };
  };
}
