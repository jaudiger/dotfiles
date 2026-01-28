{ ... }:

{
  modules.home-manager = {
    programs = {
      k9s = {
        enable = true;

        settings = {
          k9s = {
            liveViewAutoRefresh = true;
            refreshRate = 4;
            maxConnRetry = 5;
            skipLatestRevCheck = true;
            noExitOnCtrlC = true;
            ui = {
              enableMouse = false;
              headless = false;
              logoless = true;
              crumbsless = true;
              reactive = true;
              noIcons = false;
            };
            logger = {
              tail = 1024;
              buffer = 8192;
              sinceSeconds = -1;
              fullScreen = false;
              textWrap = true;
              showTime = false;
            };
          };
        };

        views = {
          views = {
            "v1/pods" = {
              sortColumn = "NAMESPACE:asc";
              columns = [
                "NAMESPACE"
                "NAME"
                "READY"
                "STATUS"
                "RESTARTS"
                "CPU"
                "%CPU/L"
                "MEM"
                "%MEM/L"
                "NODE"
                "AGE"
                # Hide the following columns
                "PF|H"
                "%CPU/R|H"
                "%MEM/R|H"
                "IP|H"
              ];
            };

            "v1/nodes" = {
              sortColumn = "NAMESPACE:asc";
              columns = [
                "NAME"
                "STATUS"
                "TAINTS"
                "VERSION"
                "PODS"
                "CPU/A"
                "%CPU"
                "MEM/A"
                "%MEM"
                "AGE"
                # Hide the following columns
                "ROLE|H"
                "CPU|H"
                "MEM|H"
              ];
            };
          };
        };

        # Community plugins: https://github.com/derailed/k9s/tree/master/plugins
        plugins = {
          # Generic plugins
          debug-container = {
            shortCut = "Shift-D";
            description = "Add a debug container";
            scopes = [
              "containers"
            ];
            command = "bash";
            background = false;
            confirm = false;
            args = [
              "-c"
              "kubectl --kubeconfig $KUBECONFIG --context $CONTEXT --namespace $NAMESPACE debug -it $POD --target=$NAME --image=nicolaka/netshoot:v0.13 --share-processes -- bash"
            ];
          };
          trace-dns = {
            shortCut = "Shift-D";
            description = "Traces DNS requests";
            scopes = [
              "containers"
              "pods"
              "nodes"
            ];
            command = "bash";
            background = false;
            confirm = false;
            args = [
              "-c"
              "|
                    IG_VERSION=v0.39.0
                    IG_IMAGE=ghcr.io/inspektor-gadget/ig:$IG_VERSION
                    IG_FIELD=k8s.podName,src,dst,qr,qtype,name,rcode,latency_ns

                    clear

                    # Handle containers
                    if [[ -n \"$POD\" ]]; then
                        echo -e \"Tracing DNS requests for container $NAME in pod $POD in namespace $NAMESPACE\"
                        IG_NODE=$(kubectl --kubeconfig $KUBECONFIG --context $CONTEXT --namespace $NAMESPACE get pod \"$POD\" -o jsonpath='{.spec.nodeName}')
                        kubectl --kubeconfig $KUBECONFIG --context $CONTEXT --namespace $NAMESPACE debug -q --profile=sysadmin \"node/$IG_NODE\" -it --image=\"$IG_IMAGE\" -- ig run trace_dns:$IG_VERSION -F \"k8s.podName==$POD\" -F \"k8s.containerName=$NAME\" --fields \"$IG_FIELD\"
                        exit
                    fi

                    # Handle pods
                    if [[ -n \"$NAMESPACE\" ]]; then
                        echo -e \"Tracing DNS requests for pod $NAME in namespace $NAMESPACE\"
                        IG_NODE=$(kubectl --kubeconfig $KUBECONFIG --context $CONTEXT --namespace $NAMESPACE get pod \"$NAME\" -o jsonpath='{.spec.nodeName}')
                        kubectl --kubeconfig $KUBECONFIG --context $CONTEXT --namespace $NAMESPACE debug -q --profile=sysadmin -it --image=\"$IG_IMAGE\" \"node/$IG_NODE\" -- ig run trace_dns:$IG_VERSION -F \"k8s.podName==$NAME\" --fields \"$IG_FIELD\"
                        exit
                    fi

                    # Handle nodes
                    echo -e \"Tracing DNS requests for node $NAME\"
                    kubectl --kubeconfig $KUBECONFIG --context $CONTEXT --namespace $NAMESPACE debug -q --profile=sysadmin -it --image=\"$IG_IMAGE\" \"node/$NAME\" -- ig run trace_dns:$IG_VERSION --fields \"$IG_FIELD\"
                "
            ];
          };

          # ArgoCD plugins
          argocd = {
            shortCut = "Shift-A";
            description = "Sync ArgoCD Application";
            scopes = [
              "applications"
            ];
            command = "argocd";
            background = false;
            confirm = false;
            args = [
              "app"
              "sync"
              "$NAME"
              "--app-namespace"
              "$NAMESPACE"
            ];
          };
          argocd-refresh-apps = {
            shortCut = "Shift-F";
            description = "Force refresh an ArgoCD application";
            scopes = [
              "applications"
            ];
            command = "kubectl";
            background = false;
            confirm = false;
            args = [
              "--kubeconfig"
              "$KUBECONFIG"
              "--context"
              "$CONTEXT"
              "--namespace"
              "$NAMESPACE"
              "annotate"
              "applications"
              "$NAME"
              "argocd.argoproj.io/refresh=hard"
            ];
          };
          argocd-disable-auto-sync = {
            shortCut = "Shift-J";
            description = "Disable ArgoCD sync";
            scopes = [
              "applications"
            ];
            command = "kubectl";
            background = false;
            confirm = false;
            args = [
              "--kubeconfig"
              "$KUBECONFIG"
              "--context"
              "$CONTEXT"
              "--namespace"
              "$NAMESPACE"
              "patch"
              "applications"
              "$NAME"
              "--type=json"
              "-p=[{\"op\":\"replace\", \"path\": \"/spec/syncPolicy\", \"value\": {}}]"
            ];
          };
          argocd-enable-auto-sync = {
            shortCut = "Shift-B";
            description = "Enable ArgoCD sync";
            scopes = [ "applications" ];
            command = "kubectl";
            background = false;
            confirm = false;
            args = [
              "--kubeconfig"
              "$KUBECONFIG"
              "--context"
              "$CONTEXT"
              "--namespace"
              "$NAMESPACE"
              "patch"
              "applications"
              "$NAME"
              "--type=merge"
              "-p={\"spec\":{\"syncPolicy\":{\"automated\":{\"prune\":true,\"selfHeal\":true},\"syncOptions\":[\"ApplyOutOfSyncOnly=true\",\"CreateNamespace=true\",\"PruneLast=true\",\"PrunePropagationPolicy=foreground\"]}}}"
            ];
          };

          # Cert manager plugins
          cert-status = {
            shortCut = "Shift-S";
            description = "Certificate status";
            scopes = [ "certificates" ];
            command = "cmctl";
            background = false;
            confirm = false;
            args = [
              "status"
              "certificate"
              "--context"
              "$CONTEXT"
              "--namespace"
              "$NAMESPACE"
              "$NAME"
            ];
          };
          cert-renew = {
            shortCut = "Shift-R";
            description = "Certificate renew";
            scopes = [ "certificates" ];
            command = "cmctl";
            background = false;
            confirm = false;
            args = [
              "renew"
              "--context"
              "$CONTEXT"
              "--namespace"
              "$NAMESPACE"
              "$NAME"
            ];
          };

          # EKS node viewer plugins
          eks-node-viewer = {
            shortCut = "Shift-X";
            description = "EKS node viewer";
            scopes = [
              "node"
            ];
            command = "bash";
            background = false;
            confirm = false;
            args = [
              "-c"
              "|
                  env $(kubectl --kubeconfig $KUBECONFIG --context $CONTEXT --namespace $NAMESPACE config view --minify -o json | jq -r \".users[0].user.exec.env[] | select(.name == \"AWS_PROFILE\") | \"AWS_PROFILE=\" + .value\" && kubectl --kubeconfig $KUBECONFIG --context $CONTEXT --namespace $NAMESPACE config view --minify -o json | jq -r \".users[0].user.exec.args | \"AWS_REGION=\" + .[1]\")

                  eks-node-viewer --kubeconfig $KUBECONFIG --context $CONTEXT --resources cpu,memory --extra-labels karpenter.sh/nodepool,eks-node-viewer/node-age --node-sort=creation=dsc
                "
            ];
          };

          # krr plugins
          krr = {
            shortCut = "Shift-K";
            description = "Get krr recommendations";
            scopes = [
              "deployments"
              "daemonsets"
              "statefulsets"
            ];
            command = "bash";
            background = false;
            confirm = false;
            args = [
              "-c"
              "|
                  LABELS=$(kubectl --kubeconfig $KUBECONFIG --context $CONTEXT --namespace $NAMESPACE get $RESOURCE_NAME $NAME --show-labels | awk '{print $NF}' | awk '{if(NR>1)print}')
                  krr simple --cluster $CONTEXT --selector $LABELS
                  echo \"Press 'q' to exit\"
                  while : ; do
                    read -n 1 k <&1
                    if [[ $k = q ]] ; then
                      break
                    fi
                  done
                "
            ];
          };

          # stern plugins
          stern = {
            shortCut = "Shift-L";
            description = "Get logs with Stern";
            scopes = [
              "pods"
            ];
            command = "stern";
            background = false;
            confirm = false;
            args = [
              "--context"
              "$CONTEXT"
              "--namespace"
              "$NAMESPACE"
              "--color"
              "always"
              "--max-log-requests"
              "1024"
              "--tail"
              "50"
              "$FILTER"
            ];
          };
        };

        aliases = {
          dp = "deployments";
          sec = "v1/secrets";
          jo = "jobs";
          cr = "clusterroles";
          crb = "clusterrolebindings";
          ro = "roles";
          rb = "rolebindings";
          np = "networkpolicies";
        };
      };

      # Enable bash auto-completion
      bash = {
        initExtra = ''
          source <(k9s completion bash)
        '';
      };

      # Enable zsh auto-completion
      zsh = {
        initContent = ''
          source <(k9s completion zsh)
        '';
      };
    };
  };
}
