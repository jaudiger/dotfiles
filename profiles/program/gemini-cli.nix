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
              command = "docker";
              args = [
                "run"
                "-i"
                "--rm"
                "-e"
                "GITHUB_PERSONAL_ACCESS_TOKEN"
                "ghcr.io/github/github-mcp-server"
              ];
              trust = true;
            };
            gitlab = {
              httpUrl = "https://gitlab.com/api/v4/mcp";
              trust = true;
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
