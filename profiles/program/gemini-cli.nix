{ ... }:

{
  modules = {
    home-manager = {
      programs.gemini-cli = {
        enable = true;

        defaultModel = "gemini-2.5-pro";

        settings = {
          experimental = {
            codebaseInvestigatorSettings = {
              maxNumTurns = 20;
              maxTimeMinutes = 5;
              thinkingBudget = 16384;
            };
          };

          general = {
            checkpointing = {
              enabled = true;
            };
            disableAutoUpdate = true;
            disableUpdateNag = true;
            enablePromptCompletion = true;
            preferredEditor = "hx";
            sessionRetention = {
              enabled = true;
              maxAge = "1w";
            };
          };

          ide = {
            hasSeenNudge = true;
          };

          mcpServers = {
            context7 = {
              command = "npx";
              args = [
                "-y"
                "@upstash/context7-mcp"
              ];
              trust = true;
            };
            github = {
              httpUrl = "https://api.githubcopilot.com/mcp";
              headers = {
                Authorization = "Bearer $GITHUB_MCP_PAT";
              };
              trust = true;
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

          privacy = {
            usageStatisticsEnabled = false;
          };

          security = {
            auth = {
              selectedType = "oauth-personal";
            };
          };

          tools = {
            autoAccept = true;
            shell = {
              pager = "less";
              showColor = true;
            };
          };

          ui = {
            showCitations = true;
            showLineNumbers = true;
          };
        };
      };
    };
  };
}
