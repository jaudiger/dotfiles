{
  lib,
  buildPythonPackage,
  pythonOlder,
  fetchFromGitHub,
  hatchling,
  jinja2,
  robotframework,
  typer-slim,
  rich,
  tomli,
  tomli-w,
  pathspec,
  platformdirs,
  pytz,
}:

buildPythonPackage rec {
  pname = "robotframework-robocop";
  version = "6.9.2";
  pyproject = true;

  disabled = pythonOlder "3.9";

  src = fetchFromGitHub {
    owner = "MarketSquare";
    repo = "robotframework-robocop";
    rev = "v${version}";
    hash = "sha256-6+Jo97G1zgg3q5tD1nbKa2ddH4F4HbQYVQgE1I4Oj+c=";
  };

  nativeBuildInputs = [
    hatchling
  ];

  # Dependencies for the build
  propagatedBuildInputs = [
    jinja2
    robotframework
    typer-slim
    rich
    tomli
    tomli-w
    pathspec
    platformdirs
    pytz
  ];

  pythonImportsCheck = [ "robocop" ];

  meta = with lib; {
    description = "Tool for static code analysis of Robot Framework language";
    homepage = "https://github.com/MarketSquare/robotframework-robocop";
    license = licenses.asl20;
    maintainers = with maintainers; [ jaudiger ];
  };
}
