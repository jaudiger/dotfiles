{
  config,
  lib,
  ...
}:

let
  isDarwin = config.nixpkgs.hostPlatform.isDarwin;
  isLinux = config.nixpkgs.hostPlatform.isLinux;
in
{
  homebrew = lib.mkIf isDarwin {
    casks = [ "visual-studio-code" ];
  };

  modules = {
    host.unfreePackages = lib.optionals isLinux [ "vscode" ];

    home-manager.programs.vscode = {
      enable = true;

      package = lib.mkIf isDarwin null;

      profiles.default.userSettings = {
        "accessibility.signals.taskCompleted" = {
          sound = "on";
        };
        "aws.suppressPrompts" = {
          regionAddAutomatically = true;
        };
        "aws.telemetry" = false;
        "boot-java.change-detection.on" = true;
        "boot-java.scan-java-test-sources.on" = true;
        "C_Cpp.inlayHints.autoDeclarationTypes.enabled" = true;
        "C_Cpp.inlayHints.parameterNames.enabled" = true;
        "C_Cpp.inlayHints.referenceOperator.enabled" = true;
        "chat.agent.enabled" = true;
        "chat.agent.maxRequests" = 32;
        "chat.commandCenter.enabled" = true;
        "chat.detectParticipant.enabled" = true;
        "chat.editor.wordWrap" = "on";
        "chat.mcp.autostart" = "newAndOutdated";
        "chat.mcp.discovery.enabled" = {
          claude-desktop = true;
        };
        "chat.renderRelatedFiles" = true;
        "claudeCode.preferredLocation" = "panel";
        "cmake.configureOnOpen" = false;
        "cmake.pinnedCommands" = [
          "workbench.action.tasks.configureTaskRunner"
          "workbench.action.tasks.runTask"
        ];
        "comments.openView" = "firstFileUnresolved";
        "cSpell.checkOnlyEnabledFileTypes" = false;
        "cSpell.userWords" = [
          "CBOR"
          "ECDSA"
          "Leshan"
          "OSCORE"
          "SENML"
          "SMSC"
          "SSID"
          "behaviour"
          "clearpage"
          "cmake"
          "coap"
          "coaps"
          "datagram"
          "deallocate"
          "deallocation"
          "deregistration"
          "deserialization"
          "dtls"
          "enablement"
          "endianness"
          "gettime"
          "gyrometer"
          "iana"
          "instanciated"
          "ioterop"
          "lorawan"
          "malloc"
          "mbed"
          "mbedtls"
          "mqtt"
          "msisdn"
          "multithread"
          "multithreaded"
          "mutex"
          "preallocated"
          "preloaded"
          "printf"
          "resending"
          "retransmission"
          "rtos"
          "struct"
          "submodules"
          "tinydtls"
          "tls"
          "uint"
          "unprocessable"
          "unregister"
          "untracked"
          "vprintf"
        ];
        "debug.closeReadonlyTabsOnEnd" = true;
        "debug.confirmOnExit" = "always";
        "debug.console.acceptSuggestionOnEnter" = "on";
        "debug.console.closeOnEnd" = true;
        "debug.javascript.enableNetworkView" = true;
        "debug.openExplorerOnEnd" = true;
        "debug.showVariableTypes" = true;
        "debug.terminal.clearBeforeReusing" = true;
        "debug.toolBarLocation" = "commandCenter";
        "diffEditor.experimental.showMoves" = true;
        "diffEditor.experimental.useTrueInlineView" = true;
        "diffEditor.hideUnchangedRegions.enabled" = true;
        "diffEditor.ignoreTrimWhitespace" = false;
        "diffEditor.renderSideBySide" = false;
        "docker.extension.enableComposeLanguageServer" = false;
        "editor.acceptSuggestionOnEnter" = "off";
        "editor.codeActionsOnSave" = {
          "source.fixAll.eslint" = "always";
        };
        "editor.experimental.preferTreeSitter.css" = true;
        "editor.experimental.preferTreeSitter.ini" = true;
        "editor.experimental.preferTreeSitter.regex" = true;
        "editor.experimental.preferTreeSitter.typescript" = true;
        "editor.foldingImportsByDefault" = true;
        "editor.foldingMaximumRegions" = 8192;
        "editor.fontFamily" = "JetBrainsMono Nerd Font";
        "editor.fontLigatures" = true;
        "editor.fontSize" = 12.5;
        "editor.guides.bracketPairs" = true;
        "editor.inlayHints.maximumLength" = 30;
        "editor.inlineSuggest.edits.renderSideBySide" = true;
        "editor.inlineSuggest.edits.showCollapsed" = true;
        "editor.lineNumbers" = "relative";
        "editor.minimap.enabled" = false;
        "editor.occurrencesHighlight" = "multiFile";
        "editor.pasteAs.preferences" = [
          "chat.attach.text"
          "text.updateImports"
        ];
        "editor.renderWhitespace" = "boundary";
        "editor.smoothScrolling" = true;
        "editor.stickyScroll.enabled" = true;
        "editor.stickyScroll.maxLineCount" = 5;
        "editor.suggest.insertMode" = "replace";
        "editor.suggest.localityBonus" = true;
        "editor.suggest.preview" = true;
        "editor.suggestSelection" = "first";
        "editor.tabCompletion" = "on";
        "editor.wordWrap" = "on";
        "eslint.format.enable" = true;
        "eslint.lintTask.enable" = true;
        "eslint.useESLintClass" = true;
        "eslint.useFlatConfig" = true;
        "eslint.validate" = [
          "javascript"
          "typescript"
          "html"
        ];
        "explorer.confirmDragAndDrop" = false;
        "explorer.fileNesting.enabled" = true;
        "explorer.incrementalNaming" = "smart";
        "extensions.ignoreRecommendations" = true;
        "files.associations" = {
          "*.json" = "jsonc";
        };
        "files.autoSave" = "afterDelay";
        "files.autoSaveWhenNoErrors" = true;
        "files.autoSaveWorkspaceFilesOnly" = true;
        "files.exclude" = {
          "**/.angular" = true;
          "**/.devenv" = true;
          "**/.git" = true;
          "**/.gradle" = true;
          "**/.idea" = true;
          "**/.jj" = true;
          "**/.venv" = true;
          "**/__pycache__" = true;
        };
        "files.insertFinalNewline" = true;
        "files.readonlyFromPermissions" = true;
        "files.trimFinalNewlines" = true;
        "files.trimTrailingWhitespace" = true;
        "files.watcherExclude" = {
          "**/.angular/**" = true;
          "**/.devenv/**" = true;
          "**/.git/objects/**" = true;
          "**/.git/subtree-cache/**" = true;
          "**/.gradle/**" = true;
          "**/.idea/**" = true;
          "**/.venv" = true;
          "**/build/**" = true;
          "**/coverage/**" = true;
          "**/dist/**" = true;
          "**/node_modules/**" = true;
          "**/output/**" = true;
          "**/target/**" = true;
          "**/__pycache__/**" = true;
        };
        "git.alwaysShowStagedChangesResourceGroup" = true;
        "git.autofetch" = true;
        "git.blame.statusBarItem.enabled" = true;
        "git.branchProtection" = [
          "main"
          "master"
          "develop"
          "development"
        ];
        "git.closeDiffOnOperation" = true;
        "git.confirmSync" = false;
        "git.enableSmartCommit" = true;
        "git.inputValidation" = true;
        "git.pruneOnFetch" = true;
        "git.repositoryScanIgnoredFolders" = [
          ".angular"
          ".devenv"
          ".git"
          ".gradle"
          ".idea"
          ".jj"
          ".venv"
          "build"
          "coverage"
          "dist"
          "node_modules"
          "output"
          "target"
          "__pycache__"
        ];
        "git.repositoryScanMaxDepth" = 2;
        "git.terminalGitEditor" = true;
        "git.timeline.showUncommitted" = true;
        "git.untrackedChanges" = "separate";
        "git.useCommitInputAsStashMessage" = true;
        "github.copilot.chat.agent.thinkingTool" = true;
        "github.copilot.chat.codeGeneration.useInstructionFiles" = true;
        "github.copilot.chat.codesearch.enabled" = true;
        "github.copilot.chat.commitMessageGeneration.instructions" = [
          {
            text = "Use conventional commit message format";
          }
        ];
        "github.copilot.chat.editor.temporalContext.enabled" = true;
        "github.copilot.chat.edits.temporalContext.enabled" = true;
        "github.copilot.chat.generateTests.codeLens" = true;
        "github.copilot.chat.languageContext.typescript.enabled" = true;
        "github.copilot.chat.newWorkspace.useContext7" = true;
        "github.copilot.chat.newWorkspaceCreation.enabled" = true;
        "github.copilot.chat.notebook.followCellExecution.enabled" = true;
        "github.copilot.chat.scopeSelection" = true;
        "github.copilot.chat.setupTests.enabled" = true;
        "github.copilot.chat.startDebugging.enabled" = true;
        "github.copilot.chat.testGeneration.instructions" = [
          {
            text = "In Java, always use Given/When/Then when writing unit tests";
          }
        ];
        "github.copilot.editor.enableAutoCompletions" = true;
        "github.copilot.enable" = {
          "*" = true;
          markdown = true;
          plaintext = true;
          scminput = true;
        };
        "github.copilot.nextEditSuggestions.enabled" = true;
        "github.copilot.nextEditSuggestions.fixes" = true;
        "github.copilot.selectedCompletionModel" = "gpt-4o-copilot";
        "inlineChat.enableV2" = true;
        "inlineChat.hideOnRequest" = true;
        "inlineChat.notebookAgent" = true;
        "java.compile.nullAnalysis.mode" = "automatic";
        "java.configuration.updateBuildConfiguration" = "automatic";
        "java.implementationCodeLens" = "all";
        "java.inlayHints.parameterNames.enabled" = "all";
        "java.signatureHelp.description.enabled" = true;
        "java.signatureHelp.enabled" = true;
        "java.test.config" = {
          coverage = {
            appendResult = false;
          };
        };
        "java.typeHierarchy.lazyLoad" = true;
        "json.maxItemsComputed" = 8192;
        "markdown.editor.pasteUrlAsFormattedLink.enabled" = "smart";
        "markdown.occurrencesHighlight.enabled" = true;
        "markdown.preview.typographer" = true;
        "markdown.suggest.paths.includeWorkspaceHeaderCompletions" = "onSingleOrDoubleHash";
        "markdown.updateLinksOnFileMove.enabled" = "prompt";
        "markdown.validate.enabled" = true;
        "multiDiffEditor.experimental.enabled" = true;
        "notebook.consolidatedRunButton" = true;
        "notebook.diff.experimental.toggleInline" = true;
        "notebook.diff.ignoreMetadata" = true;
        "notebook.diff.ignoreOutputs" = true;
        "notebook.inlineValues" = true;
        "notebook.lineNumbers" = "on";
        "notebook.multiCursor.enabled" = true;
        "notebook.outline.showCodeCells" = true;
        "notebook.output.scrolling" = true;
        "notebook.output.wordWrap" = true;
        "notebook.stickyScroll.enabled" = true;
        "notebook.variablesView" = true;
        "python.analysis.aiCodeActions" = {
          convertFormatString = true;
          generateSymbol = true;
        };
        "python.analysis.aiHoverSummaries" = true;
        "python.analysis.diagnosticMode" = "workspace";
        "python.analysis.enableEditableInstalls" = true;
        "python.analysis.includeAliasesFromUserFiles" = true;
        "python.analysis.inlayHints.callArgumentNames" = "all";
        "python.analysis.languageServerMode" = "full";
        "python.analysis.supportDocstringTemplate" = true;
        "python.analysis.supportRestructuredText" = true;
        "python.analysis.usePullDiagnostics" = true;
        "python.experiments.optInto" = [
          "pythonTerminalEnvVarActivation"
        ];
        "python.linting.pylintArgs" = [
          "--disable=C0103,C0111,C0301,C0302,C0325,C0326,E1601,R0902,R0903,R0911,R0912,R0913,R0914,R0915,R0916,W0221,W0401,W0403,W0613,W0614"
        ];
        "python.locator" = "native";
        "python.REPL.sendToNativeREPL" = true;
        "python.terminal.shellIntegration.enabled" = true;
        "python.testing.pytestArgs" = [
          "--color=yes"
        ];
        "remote.defaultExtensionsIfInstalledLocally" = [
          "GitHub.copilot"
          "GitHub.copilot-chat"
        ];
        "rust-analyzer" = {
          cargo = {
            allTargets = true;
            features = "all";
          };
          check = {
            allTargets = true;
            command = "clippy";
          };
          imports = {
            granularity = {
              group = "item";
            };
          };
          inlayHints = {
            "closingBraceHints.enable" = false;
            closureStyle = "rust_analyzer";
            "discriminantHints.enable" = "fieldless";
            "expressionAdjustmentHints.enable" = "never";
            "implicitDrops.enable" = true;
            "lifetimeElisionHints.enable" = "skip_trivial";
            "parameterHints.enable" = true;
            "typeHints.enable" = true;
          };
          lens = {
            references = {
              "adt.enabled" = true;
              "enumVariant.enable" = true;
              "method.enabled" = true;
              "trait.enabled" = true;
            };
          };
          references = {
            excludeImports = true;
            excludeTests = true;
          };
          rust = {
            analyzerTargetDir = true;
          };
          testExplorer = true;
        };
        "scm.diffDecorationsIgnoreTrimWhitespace" = "inherit";
        "scm.workingSets.enabled" = true;
        "search.searchView.keywordSuggestions" = true;
        "search.searchView.semanticSearchBehavior" = "runOnEmpty";
        "search.smartCase" = true;
        "sonarlint.connectedMode.connections.sonarqube" = [
          {
            serverUrl = "https://sonarqube.ioterop.com";
          }
        ];
        "spring-boot.ls.checkJVM" = false;
        "telemetry.telemetryLevel" = "off";
        "terminal.integrated.allowChords" = false;
        "terminal.integrated.cursorBlinking" = true;
        "terminal.integrated.enableMultiLinePasteWarning" = "never";
        "terminal.integrated.fontLigatures.enabled" = true;
        "terminal.integrated.fontSize" = 11.5;
        "terminal.integrated.hideOnLastClosed" = false;
        "terminal.integrated.hideOnStartup" = "whenEmpty";
        "terminal.integrated.middleClickBehavior" = "paste";
        "terminal.integrated.mouseWheelZoom" = true;
        "terminal.integrated.persistentSessionReviveProcess" = "onExitAndWindowClose";
        "terminal.integrated.profiles.linux" = {
          Nushell = {
            path = "nu";
          };
          Zellij = {
            path = "zellij";
          };
        };
        "terminal.integrated.profiles.osx" = {
          Nushell = {
            path = "nu";
          };
          Zellij = {
            path = "zellij";
          };
        };
        "terminal.integrated.rescaleOverlappingGlyphs" = true;
        "terminal.integrated.scrollback" = 8192;
        "terminal.integrated.smoothScrolling" = true;
        "terminal.integrated.stickyScroll.enabled" = true;
        "terminal.integrated.suggest.enabled" = true;
        "terminal.integrated.tabs.enabled" = true;
        "testExplorer.useNativeTesting" = true;
        "typescript.implementationsCodeLens.enabled" = true;
        "typescript.inlayHints.enumMemberValues.enabled" = true;
        "typescript.inlayHints.functionLikeReturnTypes.enabled" = true;
        "typescript.inlayHints.parameterNames.enabled" = "all";
        "typescript.inlayHints.parameterTypes.enabled" = true;
        "typescript.inlayHints.propertyDeclarationTypes.enabled" = true;
        "typescript.inlayHints.variableTypes.enabled" = true;
        "typescript.preferences.importModuleSpecifier" = "non-relative";
        "typescript.tsserver.experimental.enableProjectDiagnostics" = true;
        "typescript.tsserver.web.typeAcquisition.enabled" = true;
        "typescript.updateImportsOnFileMove.enabled" = "always";
        "update.showReleaseNotes" = false;
        "vsintellicode.modify.editor.suggestSelection" = "automaticallyOverrodeDefaultValue";
        "websearch.preferredEngine" = "bing";
        "window.commandCenter" = true;
        "window.confirmBeforeClose" = "keyboardOnly";
        "window.density.editorTabHeight" = "compact";
        "window.menuStyle" = "inherit";
        "window.titleBarStyle" = "custom";
        "workbench.activityBar.location" = "top";
        "workbench.colorTheme" = "Light Modern";
        "workbench.commandPalette.experimental.askChatLocation" = "quickChat";
        "workbench.editor.autoLockGroups" = {
          "imagePreview.previewEditor" = true;
          "mainThreadWebview-markdown.preview" = true;
          "vscode.markdown.preview.editor" = true;
        };
        "workbench.editor.highlightModifiedTabs" = true;
        "workbench.editor.showTabs" = "none";
        "workbench.editor.tabActionLocation" = "left";
        "workbench.editor.tabSizing" = "fixed";
        "workbench.editor.tabSizingFixedMinWidth" = 100;
        "workbench.list.scrollByPage" = true;
        "workbench.list.smoothScrolling" = true;
        "workbench.navigationControl.enabled" = false;
        "workbench.panel.showLabels" = false;
        "workbench.settings.editor" = "json";
        "workbench.settings.showAISearchToggle" = true;
        "workbench.settings.useSplitJSON" = true;
        "workbench.sideBar.location" = "right";
        "workbench.tree.enableStickyScroll" = true;
        "xml.symbols.maxItemsComputed" = 8192;
        "yaml.customTags" = [
          "!And"
          "!And sequence"
          "!Base64"
          "!Cidr"
          "!Equals"
          "!Equals sequence"
          "!FindInMap"
          "!FindInMap sequence"
          "!GetAtt"
          "!GetAZs"
          "!If"
          "!If sequence"
          "!ImportValue"
          "!ImportValue sequence"
          "!Join"
          "!Join sequence"
          "!Not"
          "!Not sequence"
          "!Or"
          "!Or sequence"
          "!Ref"
          "!Select"
          "!Select sequence"
          "!Split"
          "!Split sequence"
          "!Sub"
          "!Sub sequence"
        ];
        "yaml.maxItemsComputed" = 8192;
        "[dockercompose]" = {
          "editor.autoIndent" = "advanced";
          "editor.defaultFormatter" = "redhat.vscode-yaml";
          "editor.insertSpaces" = true;
          "editor.quickSuggestions" = {
            comments = false;
            other = true;
            strings = true;
          };
          "editor.tabSize" = 2;
        };
        "[github-actions-workflow]" = {
          "editor.defaultFormatter" = "redhat.vscode-yaml";
        };
        "[markdown]" = {
          "editor.defaultFormatter" = "DavidAnson.vscode-markdownlint";
        };
        "[python]" = {
          "editor.formatOnType" = true;
        };
      };
    };
  };
}
