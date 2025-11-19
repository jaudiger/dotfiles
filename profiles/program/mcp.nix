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
          url = "https://api.githubcopilot.com/mcp";
          headers = {
            Authorization = "Bearer $GITHUB_MCP_PAT";
          };
        };
        gitlab = {
          url = "https://gitlab.com/api/v4/mcp";
        };
        sonarqube = {
          command = "docker";
          args = [
            "run"
            "-i"
            "--name"
            "sonarqube-mcp-server"
            "--rm"
            "-e"
            "SONARQUBE_TOKEN"
            "-e"
            "SONARQUBE_URL"
            "mcp/sonarqube"
          ];
          env = {
            SONARQUBE_TOKEN = "$SONARQUBE_TOKEN";
            SONARQUBE_URL = "$SONARQUBE_URL";
          };
        };
        terraform = {
          command = "docker";
          args = [
            "run"
            "-i"
            "--name"
            "terraform-mcp-server"
            "--rm"
            "-e"
            "TERRAFORM_TOKEN"
            "-e"
            "TERRAFORM_URL"
            "hashicorp/terraform-mcp-server"
          ];
          env = {
            TERRAFORM_TOKEN = "$TERRAFORM_TOKEN";
            TERRAFORM_URL = "$TERRAFORM_URL";
          };
        };
      };
    };
  };
}
