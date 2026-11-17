{
  lib,
  buildPythonPackage,
  pythonOlder,
  fetchFromGitHub,
  hatchling,
  jinja2,
  robotframework,
  typer,
  rich,
  tomli,
  tomli-w,
  pathspec,
  platformdirs,
  msgpack,
  typing-extensions,
}:

buildPythonPackage rec {
  pname = "robotframework-robocop";
  version = "9.4.0";
  pyproject = true;

  disabled = pythonOlder "3.10";

  src = fetchFromGitHub {
    owner = "MarketSquare";
    repo = "robotframework-robocop";
    rev = "v${version}";
    hash = "sha256-bs/TH5/k1CxGBCNk2UdcrFbiFdw8TI5KYfjrn//bD0k=";
  };

  nativeBuildInputs = [
    hatchling
  ];

  # Dependencies for the build
  propagatedBuildInputs = [
    jinja2
    robotframework
    typer
    rich
    tomli
    tomli-w
    pathspec
    platformdirs
    msgpack
    typing-extensions
  ];

  pythonImportsCheck = [ "robocop" ];

  meta = with lib; {
    description = "Tool for static code analysis of Robot Framework language";
    homepage = "https://github.com/MarketSquare/robotframework-robocop";
    license = licenses.asl20;
    maintainers = with maintainers; [ jaudiger ];
  };
}
